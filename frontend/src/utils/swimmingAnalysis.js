import { KEYPOINT_MAP } from './movenet'

function getKp(pose, name) {
  const idx = KEYPOINT_MAP[name]
  return idx !== undefined ? pose.keypoints[idx] : null
}

function angle(a, vertex, b) {
  const va = { x: a.x - vertex.x, y: a.y - vertex.y }
  const vb = { x: b.x - vertex.x, y: b.y - vertex.y }
  const dot = va.x * vb.x + va.y * vb.y
  const m = Math.sqrt((va.x ** 2 + va.y ** 2) * (vb.x ** 2 + vb.y ** 2))
  if (m === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function hasScore(...kps) {
  return kps.every(kp => kp && kp.score > 0.3)
}

const PHASE = {
  ENTRY: 'entry',
  PULL: 'pull',
  RECOVERY: 'recovery',
  UNKNOWN: 'unknown',
}

const STROKE = {
  FREESTYLE: 'Freestyle',
  BACKSTROKE: 'Backstroke',
  BREASTSTROKE: 'Breaststroke',
  BUTTERFLY: 'Butterfly',
  UNKNOWN: 'Detecting...',
}

function correlation(arrA, arrB) {
  const n = Math.min(arrA.length, arrB.length)
  if (n < 5) return 0
  const a = arrA.slice(-n)
  const b = arrB.slice(-n)
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  return den === 0 ? 0 : num / den
}

function stddev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

export class StrokeAnalyzer {
  constructor() {
    this.wristHistory = { left: [], right: [] }
    this.shoulderHistory = []
    this.hipHistory = []
    this.headHistory = []
    this.strokes = []
    this.currentPhase = { left: PHASE.UNKNOWN, right: PHASE.UNKNOWN }
    this.prevWristY = { left: null, right: null }
    this.lastStrokeTime = { left: null, right: null }
    this.allArmExtensions = { left: [], right: [] }
    this.frameCount = 0
    this.frameStrokeRecorded = false
    this.detectedStroke = STROKE.UNKNOWN
    this.strokeConfidence = 0
    this.strokeVotes = {}
  }

  reset() {
    this.wristHistory = { left: [], right: [] }
    this.shoulderHistory = []
    this.hipHistory = []
    this.headHistory = []
    this.strokes = []
    this.currentPhase = { left: PHASE.UNKNOWN, right: PHASE.UNKNOWN }
    this.prevWristY = { left: null, right: null }
    this.lastStrokeTime = { left: null, right: null }
    this.allArmExtensions = { left: [], right: [] }
    this.frameCount = 0
    this.frameStrokeRecorded = false
    this.detectedStroke = STROKE.UNKNOWN
    this.strokeConfidence = 0
    this.strokeVotes = {}
  }

  processFrame(pose) {
    this.frameCount++
    const now = Date.now()
    this.frameStrokeRecorded = false

    const leftWrist = getKp(pose, 'leftWrist')
    const rightWrist = getKp(pose, 'rightWrist')
    const leftShoulder = getKp(pose, 'leftShoulder')
    const rightShoulder = getKp(pose, 'rightShoulder')
    const leftHip = getKp(pose, 'leftHip')
    const rightHip = getKp(pose, 'rightHip')
    const nose = getKp(pose, 'nose')

    if (hasScore(leftWrist)) {
      this.wristHistory.left.push({ y: leftWrist.y, x: leftWrist.x, t: now })
      if (this.wristHistory.left.length > 90) this.wristHistory.left.shift()
    }
    if (hasScore(rightWrist)) {
      this.wristHistory.right.push({ y: rightWrist.y, x: rightWrist.x, t: now })
      if (this.wristHistory.right.length > 90) this.wristHistory.right.shift()
    }
    if (hasScore(leftShoulder, rightShoulder)) {
      this.shoulderHistory.push({
        leftY: leftShoulder.y,
        rightY: rightShoulder.y,
        leftX: leftShoulder.x,
        rightX: rightShoulder.x,
        t: now,
      })
      if (this.shoulderHistory.length > 90) this.shoulderHistory.shift()
    }
    if (hasScore(leftHip, rightHip)) {
      const hipMidY = (leftHip.y + rightHip.y) / 2
      this.hipHistory.push({ y: hipMidY, t: now })
      if (this.hipHistory.length > 90) this.hipHistory.shift()
    }
    if (hasScore(nose, leftShoulder, rightShoulder)) {
      const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
      this.headHistory.push({ noseY: nose.y, shoulderMidY, t: now })
      if (this.headHistory.length > 90) this.headHistory.shift()
    }

    this.detectPhase('left', leftWrist, now)
    this.detectPhase('right', rightWrist, now)

    const leftArmExt = this.computeArmExtension(pose, 'left')
    const rightArmExt = this.computeArmExtension(pose, 'right')
    if (leftArmExt !== null) this.allArmExtensions.left.push(leftArmExt)
    if (rightArmExt !== null) this.allArmExtensions.right.push(rightArmExt)

    this.detectStrokeType()

    return this.getSnapshot(pose)
  }

  detectStrokeType() {
    if (this.frameCount < 15) {
      this.detectedStroke = STROKE.UNKNOWN
      this.strokeConfidence = 0
      return
    }

    const leftYs = this.wristHistory.left.map(h => h.y)
    const rightYs = this.wristHistory.right.map(h => h.y)
    const shoulderDiffs = this.shoulderHistory.map(h => Math.abs(h.leftY - h.rightY))
    const hipYs = this.hipHistory.map(h => h.y)

    const corr = correlation(leftYs, rightYs)
    const shoulderRoll = stddev(shoulderDiffs)
    const hipUndulation = stddev(hipYs)

    const noseAboveShoulders = this.headHistory.length > 10
      ? this.headHistory.slice(-10).filter(h => h.noseY < h.shoulderMidY).length > 5
      : null

    const wristRange = Math.max(
      stddev(leftYs) + stddev(rightYs),
      1
    )
    const normalizedShoulderRoll = shoulderRoll / wristRange
    const normalizedHipUndulation = hipUndulation / wristRange

    const leftAmplitude = stddev(leftYs)
    const rightAmplitude = stddev(rightYs)
    const bothArmsActive = leftAmplitude > 5 && rightAmplitude > 5

    let stroke = STROKE.UNKNOWN
    let confidence = 0

    if (corr < -0.4 && bothArmsActive) {
      if (noseAboveShoulders === true) {
        stroke = STROKE.BACKSTROKE
        confidence = Math.min(100, Math.round(Math.abs(corr) * 70 + normalizedShoulderRoll * 30))
      } else {
        stroke = STROKE.FREESTYLE
        confidence = Math.min(100, Math.round(Math.abs(corr) * 70 + normalizedShoulderRoll * 25 + (bothArmsActive ? 10 : 0)))
      }
    } else if (corr > 0.3 && bothArmsActive) {
      if (normalizedHipUndulation > 0.15 || hipUndulation > 15) {
        stroke = STROKE.BUTTERFLY
        confidence = Math.min(100, Math.round(corr * 50 + normalizedHipUndulation * 50))
      } else {
        stroke = STROKE.BREASTSTROKE
        confidence = Math.min(100, Math.round(corr * 50 + (1 - normalizedHipUndulation) * 40))
      }
    } else if (corr < -0.2 && bothArmsActive) {
      if (noseAboveShoulders === true) {
        stroke = STROKE.BACKSTROKE
        confidence = Math.min(80, Math.round(Math.abs(corr) * 60 + normalizedShoulderRoll * 20))
      } else {
        stroke = STROKE.FREESTYLE
        confidence = Math.min(80, Math.round(Math.abs(corr) * 60 + normalizedShoulderRoll * 15))
      }
    } else {
      confidence = Math.max(0, 20 - Math.abs(corr) * 30)
    }

    // Accumulate confidence-weighted votes per stroke so a few noisy frames
    // can't flip the classification back and forth.
    if (stroke !== STROKE.UNKNOWN && confidence > 0) {
      this.strokeVotes[stroke] = (this.strokeVotes[stroke] || 0) + confidence
    }

    let bestStroke = STROKE.UNKNOWN
    let bestVotes = 0
    let totalVotes = 0
    for (const [name, votes] of Object.entries(this.strokeVotes)) {
      totalVotes += votes
      if (votes > bestVotes) {
        bestVotes = votes
        bestStroke = name
      }
    }

    if (bestStroke !== STROKE.UNKNOWN && totalVotes > 0) {
      this.detectedStroke = bestStroke
      // Confidence = how dominant the winning stroke is, scaled by the
      // strength of its own frame-level confidences.
      const dominance = bestVotes / totalVotes
      const avgFrameConfidence = Math.min(100, bestVotes / Math.max(1, this.frameCount / 10))
      this.strokeConfidence = Math.round(
        Math.max(0, Math.min(100, dominance * 60 + avgFrameConfidence * 0.4))
      )
    } else {
      this.detectedStroke = STROKE.UNKNOWN
      this.strokeConfidence = Math.round(confidence)
    }
  }

  detectPhase(side, wrist, now) {
    if (!hasScore(wrist)) return

    const history = this.wristHistory[side]
    if (history.length < 5) return

    const recent = history.slice(-5)
    const avgY = recent.reduce((s, h) => s + h.y, 0) / recent.length

    const prevAvgY = this.prevWristY[side]
    this.prevWristY[side] = avgY

    if (prevAvgY === null) return

    const yVelocity = avgY - prevAvgY
    const prevPhase = this.currentPhase[side]

    if (prevPhase === PHASE.RECOVERY || prevPhase === PHASE.UNKNOWN) {
      if (yVelocity > 0.5 && avgY > (prevAvgY + 1)) {
        this.currentPhase[side] = PHASE.ENTRY

        if (this.lastStrokeTime[side] !== null && !this.frameStrokeRecorded) {
          const strokeDuration = now - this.lastStrokeTime[side]
          if (strokeDuration > 300 && strokeDuration < 5000) {
            this.strokes.push({
              side,
              time: now,
              duration: strokeDuration,
            })
            if (this.strokes.length > 50) this.strokes.shift()
            this.frameStrokeRecorded = true
          }
        }
        this.lastStrokeTime[side] = now
      }
    } else if (prevPhase === PHASE.ENTRY || prevPhase === PHASE.PULL) {
      if (yVelocity < -0.5) {
        this.currentPhase[side] = PHASE.RECOVERY
      } else if (yVelocity > 0.5) {
        this.currentPhase[side] = PHASE.PULL
      }
    }
  }

  computeArmExtension(pose, side) {
    const shoulder = getKp(pose, `${side}Shoulder`)
    const elbow = getKp(pose, `${side}Elbow`)
    const wrist = getKp(pose, `${side}Wrist`)
    if (!hasScore(shoulder, elbow, wrist)) return null

    const ang = angle(shoulder, elbow, wrist)
    return Math.max(0, Math.min(100, ((ang - 30) / 150) * 100))
  }

  getHeadAlignment(pose) {
    const nose = getKp(pose, 'nose')
    const leftShoulder = getKp(pose, 'leftShoulder')
    const rightShoulder = getKp(pose, 'rightShoulder')
    if (!hasScore(nose, leftShoulder, rightShoulder)) return null

    const midX = (leftShoulder.x + rightShoulder.x) / 2
    const offset = Math.abs(nose.x - midX)
    const shoulderW = dist(leftShoulder, rightShoulder)
    return Math.max(0, Math.min(100, 100 - (offset / shoulderW) * 200))
  }

  getSnapshot(pose) {
    const recentStrokes = this.strokes.slice(-10)

    let strokeRate = 0
    if (recentStrokes.length >= 2) {
      const timeSpan = (recentStrokes[recentStrokes.length - 1].time - recentStrokes[0].time) / 1000
      if (timeSpan > 0) {
        strokeRate = Math.round((recentStrokes.length / timeSpan) * 60)
      }
    }

    let consistency = 100
    if (recentStrokes.length >= 3) {
      const durations = recentStrokes.map(s => s.duration)
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length
      const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length
      const cv = Math.sqrt(variance) / mean
      consistency = Math.max(0, Math.round(100 - cv * 200))
    }

    let symmetry = 50
    const leftStrokes = recentStrokes.filter(s => s.side === 'left')
    const rightStrokes = recentStrokes.filter(s => s.side === 'right')

    if (leftStrokes.length > 0 && rightStrokes.length > 0) {
      const lastLeft = leftStrokes[leftStrokes.length - 1]
      const lastRight = rightStrokes[rightStrokes.length - 1]
      const ratio = Math.min(lastLeft.duration, lastRight.duration) / Math.max(lastLeft.duration, lastRight.duration)
      symmetry = Math.round(ratio * 100)
    }

    const avgLeftExt = this.allArmExtensions.left.length > 0
      ? Math.round(this.allArmExtensions.left.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, this.allArmExtensions.left.length))
      : 50
    const avgRightExt = this.allArmExtensions.right.length > 0
      ? Math.round(this.allArmExtensions.right.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, this.allArmExtensions.right.length))
      : 50

    const headAlignment = pose ? this.getHeadAlignment(pose) : null

    return {
      strokeCount: recentStrokes.length,
      strokeRate,
      consistency,
      symmetry,
      avgLeftExtension: avgLeftExt,
      avgRightExtension: avgRightExt,
      headAlignment,
      phases: { ...this.currentPhase },
      recentStrokes: recentStrokes.slice(-6),
      strokeType: this.detectedStroke,
      strokeConfidence: this.strokeConfidence,
    }
  }
}

export { STROKE }
