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

export class StrokeAnalyzer {
  constructor() {
    this.wristHistory = { left: [], right: [] }
    this.strokes = []
    this.currentPhase = { left: PHASE.UNKNOWN, right: PHASE.UNKNOWN }
    this.prevWristY = { left: null, right: null }
    this.lastStrokeTime = { left: null, right: null }
    this.allArmExtensions = { left: [], right: [] }
    this.frameCount = 0
  }

  reset() {
    this.wristHistory = { left: [], right: [] }
    this.strokes = []
    this.currentPhase = { left: PHASE.UNKNOWN, right: PHASE.UNKNOWN }
    this.prevWristY = { left: null, right: null }
    this.lastStrokeTime = { left: null, right: null }
    this.allArmExtensions = { left: [], right: [] }
    this.frameCount = 0
  }

  processFrame(pose) {
    this.frameCount++
    const now = Date.now()
    this.frameStrokeRecorded = false

    const leftWrist = getKp(pose, 'leftWrist')
    const rightWrist = getKp(pose, 'rightWrist')

    if (hasScore(leftWrist)) {
      this.wristHistory.left.push({ y: leftWrist.y, t: now })
      if (this.wristHistory.left.length > 60) this.wristHistory.left.shift()
    }
    if (hasScore(rightWrist)) {
      this.wristHistory.right.push({ y: rightWrist.y, t: now })
      if (this.wristHistory.right.length > 60) this.wristHistory.right.shift()
    }

    this.detectPhase('left', leftWrist, now)
    this.detectPhase('right', rightWrist, now)

    const leftArmExt = this.computeArmExtension(pose, 'left')
    const rightArmExt = this.computeArmExtension(pose, 'right')
    if (leftArmExt !== null) this.allArmExtensions.left.push(leftArmExt)
    if (rightArmExt !== null) this.allArmExtensions.right.push(rightArmExt)

    return this.getSnapshot(pose)
  }

  detectPhase(side, wrist, now) {
    if (!hasScore(wrist)) return

    const history = this.wristHistory[side]
    if (history.length < 5) return

    // Smooth the Y position using last 5 frames
    const recent = history.slice(-5)
    const avgY = recent.reduce((s, h) => s + h.y, 0) / recent.length

    const prevAvgY = this.prevWristY[side]
    this.prevWristY[side] = avgY

    if (prevAvgY === null) return

    const yVelocity = avgY - prevAvgY // positive = moving down in frame = moving up physically

    const prevPhase = this.currentPhase[side]

    // Detection logic:
    // RECOVERY → wrist moves UP in frame (y decreases, negative velocity) = hand exiting water going forward
    // ENTRY → wrist at highest point (y minimal), velocity transitions from negative to positive
    // PULL → wrist moves DOWN in frame (y increases, positive velocity) = hand pulling back

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

  getAllKeypoints() {
    return []
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

    // Stroke rate (strokes per minute)
    let strokeRate = 0
    if (recentStrokes.length >= 2) {
      const timeSpan = (recentStrokes[recentStrokes.length - 1].time - recentStrokes[0].time) / 1000
      if (timeSpan > 0) {
        strokeRate = Math.round((recentStrokes.length / timeSpan) * 60)
      }
    }

    // Stroke consistency (coefficient of variation of durations, lower = more consistent)
    let consistency = 100
    if (recentStrokes.length >= 3) {
      const durations = recentStrokes.map(s => s.duration)
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length
      const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length
      const cv = Math.sqrt(variance) / mean
      consistency = Math.max(0, Math.round(100 - cv * 200))
    }

    // Per-stroke symmetry (compare last left and right strokes)
    let symmetry = 50
    const leftStrokes = recentStrokes.filter(s => s.side === 'left')
    const rightStrokes = recentStrokes.filter(s => s.side === 'right')

    if (leftStrokes.length > 0 && rightStrokes.length > 0) {
      const lastLeft = leftStrokes[leftStrokes.length - 1]
      const lastRight = rightStrokes[rightStrokes.length - 1]

      const ratio = Math.min(lastLeft.duration, lastRight.duration) / Math.max(lastLeft.duration, lastRight.duration)
      symmetry = Math.round(ratio * 100)
    }

    // Average arm extensions
    const avgLeftExt = this.allArmExtensions.left.length > 0
      ? Math.round(this.allArmExtensions.left.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, this.allArmExtensions.left.length))
      : 50
    const avgRightExt = this.allArmExtensions.right.length > 0
      ? Math.round(this.allArmExtensions.right.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, this.allArmExtensions.right.length))
      : 50

    const headAlignment = this.getHeadAlignment(pose)

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
    }
  }
}
