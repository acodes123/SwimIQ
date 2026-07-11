const KEYPOINT_MAP = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
}

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

function hasScore(...kps) {
  return kps.every(kp => kp && kp.score > 0.3)
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
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

const PHASE = { ENTRY: 'entry', PULL: 'pull', RECOVERY: 'recovery', UNKNOWN: 'unknown' }
const STROKE = { FREESTYLE: 'Freestyle', BACKSTROKE: 'Backstroke', BREASTSTROKE: 'Breaststroke', BUTTERFLY: 'Butterfly', UNKNOWN: 'Detecting...' }

class StrokeAnalyzer {
  constructor() {
    this.wristHistory = { left: [], right: [] }
    this.shoulderHistory = []
    this.hipHistory = []
    this.headHistory = []
    this.strokes = []
    this.currentPhase = { left: PHASE.UNKNOWN, right: PHASE.UNKNOWN }
    this.prevWristY = { left: null, right: null }
    this.lastStrokeTime = { left: null, right: null }
    this.frameCount = 0
    this.frameStrokeRecorded = false
    this.detectedStroke = STROKE.UNKNOWN
    this.strokeConfidence = 0
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
      this.wristHistory.left.push({ y: leftWrist.y, t: now })
      if (this.wristHistory.left.length > 90) this.wristHistory.left.shift()
    }
    if (hasScore(rightWrist)) {
      this.wristHistory.right.push({ y: rightWrist.y, t: now })
      if (this.wristHistory.right.length > 90) this.wristHistory.right.shift()
    }
    if (hasScore(leftShoulder, rightShoulder)) {
      this.shoulderHistory.push({ leftY: leftShoulder.y, rightY: rightShoulder.y, t: now })
      if (this.shoulderHistory.length > 90) this.shoulderHistory.shift()
    }
    if (hasScore(leftHip, rightHip)) {
      this.hipHistory.push({ y: (leftHip.y + rightHip.y) / 2, t: now })
      if (this.hipHistory.length > 90) this.hipHistory.shift()
    }
    if (hasScore(nose, leftShoulder, rightShoulder)) {
      this.headHistory.push({ noseY: nose.y, shoulderMidY: (leftShoulder.y + rightShoulder.y) / 2, t: now })
      if (this.headHistory.length > 90) this.headHistory.shift()
    }

    this.detectPhase('left', leftWrist, now)
    this.detectPhase('right', rightWrist, now)
    this.detectStrokeType()

    return this.getSnapshot()
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

    const wristRange = Math.max(stddev(leftYs) + stddev(rightYs), 1)
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

    if (confidence > this.strokeConfidence || stroke !== STROKE.UNKNOWN) {
      this.detectedStroke = stroke
      this.strokeConfidence = confidence
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
            this.strokes.push({ side, time: now, duration: strokeDuration })
            if (this.strokes.length > 50) this.strokes.shift()
            this.frameStrokeRecorded = true
          }
        }
        this.lastStrokeTime[side] = now
      }
    } else if (prevPhase === PHASE.ENTRY || prevPhase === PHASE.PULL) {
      if (yVelocity < -0.5) this.currentPhase[side] = PHASE.RECOVERY
      else if (yVelocity > 0.5) this.currentPhase[side] = PHASE.PULL
    }
  }

  getSnapshot() {
    const recentStrokes = this.strokes.slice(-10)
    let strokeRate = 0
    if (recentStrokes.length >= 2) {
      const timeSpan = (recentStrokes[recentStrokes.length - 1].time - recentStrokes[0].time) / 1000
      if (timeSpan > 0) strokeRate = Math.round((recentStrokes.length / timeSpan) * 60)
    }
    let consistency = 100
    if (recentStrokes.length >= 3) {
      const durations = recentStrokes.map(s => s.duration)
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length
      const cv = Math.sqrt(durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length) / mean
      consistency = Math.max(0, Math.round(100 - cv * 200))
    }
    const leftStrokes = recentStrokes.filter(s => s.side === 'left')
    const rightStrokes = recentStrokes.filter(s => s.side === 'right')
    let symmetry = 50
    if (leftStrokes.length > 0 && rightStrokes.length > 0) {
      const ratio = Math.min(leftStrokes.at(-1).duration, rightStrokes.at(-1).duration) /
        Math.max(leftStrokes.at(-1).duration, rightStrokes.at(-1).duration)
      symmetry = Math.round(ratio * 100)
    }
    return {
      strokeCount: recentStrokes.length, strokeRate, consistency, symmetry,
      avgLeftExtension: 50, avgRightExtension: 50, headAlignment: 80,
      phases: { ...this.currentPhase }, recentStrokes: recentStrokes.slice(-6),
      strokeType: this.detectedStroke, strokeConfidence: this.strokeConfidence,
    }
  }
}

function createPose(overrides = {}) {
  const base = [
    { x: 320, y: 80, score: 0.9 }, { x: 310, y: 75, score: 0.9 },
    { x: 330, y: 75, score: 0.9 }, { x: 295, y: 78, score: 0.8 },
    { x: 345, y: 78, score: 0.8 }, { x: 260, y: 150, score: 0.9 },
    { x: 380, y: 150, score: 0.9 }, { x: 200, y: 200, score: 0.9 },
    { x: 440, y: 200, score: 0.9 }, { x: 150, y: 150, score: 0.9 },
    { x: 490, y: 150, score: 0.9 }, { x: 280, y: 300, score: 0.9 },
    { x: 360, y: 300, score: 0.9 }, { x: 270, y: 400, score: 0.8 },
    { x: 370, y: 400, score: 0.8 }, { x: 260, y: 500, score: 0.7 },
    { x: 380, y: 500, score: 0.7 },
  ]
  const idxMap = { leftWrist: 9, rightWrist: 10, leftElbow: 7, rightElbow: 8, leftShoulder: 5, rightShoulder: 6, leftHip: 11, rightHip: 12, nose: 0 }
  const keypoints = base.map(kp => ({ ...kp }))
  for (const [name, pos] of Object.entries(overrides)) {
    if (idxMap[name] !== undefined) keypoints[idxMap[name]] = { ...keypoints[idxMap[name]], ...pos }
  }
  return { keypoints }
}

// ========= TESTS =========
console.log('=== SwimIQ Stroke Type Detection Test ===\n')

const originalDateNow = Date.now

function runTest(name, leftFn, rightFn, expectedStroke, overrides = {}, frames = 120) {
  const analyzer = new StrokeAnalyzer()
  let fakeTime = Date.now()
  Date.now = () => fakeTime

  for (let i = 0; i < frames; i++) {
    fakeTime += 33
    const leftWristY = leftFn(i, frames)
    const rightWristY = rightFn(i, frames)
    const poseOverrides = {
      leftWrist: { y: leftWristY },
      rightWrist: { y: rightWristY },
      nose: { y: overrides.noseY || 80 },
      leftShoulder: { y: overrides.shoulderY || 150 },
      rightShoulder: { y: overrides.shoulderY || 150 },
      leftHip: { y: overrides.hipYFn ? overrides.hipYFn(i) : 300 },
      rightHip: { y: overrides.hipYFn ? overrides.hipYFn(i) : 300 },
    }
    analyzer.processFrame(createPose(poseOverrides))
  }

  Date.now = originalDateNow
  const snap = analyzer.getSnapshot()
  const pass = snap.strokeType === expectedStroke
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  console.log(`  Detected: ${snap.strokeType} (${snap.strokeConfidence}%) | Expected: ${expectedStroke}`)
  return pass
}

let allPass = true

// Freestyle: arms alternate (anti-correlated), face down (nose Y > shoulder Y)
allPass &= runTest(
  'Freestyle (alternating arms, face down)',
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 100,
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6 + Math.PI) * 100,
  'Freestyle',
  { noseY: 250, shoulderY: 150 }
)

// Backstroke: arms alternate (anti-correlated), face up (nose Y < shoulder Y)
allPass &= runTest(
  'Backstroke (alternating arms, face up)',
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 100,
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6 + Math.PI) * 100,
  'Backstroke',
  { noseY: 80, shoulderY: 150 }
)

// Breaststroke: arms together (correlated), flat body
allPass &= runTest(
  'Breaststroke (arms together, flat body)',
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 80,
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 80,
  'Breaststroke',
  { noseY: 250, shoulderY: 150, hipYFn: () => 300 }
)

// Butterfly: arms together (correlated), high hip undulation
allPass &= runTest(
  'Butterfly (arms together, undulating body)',
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 100,
  (i) => 200 + Math.sin(i / 120 * Math.PI * 6) * 100,
  'Butterfly',
  { noseY: 250, shoulderY: 150, hipYFn: (i) => 300 + Math.sin(i / 120 * Math.PI * 4) * 40 }
)

console.log(`\n${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
