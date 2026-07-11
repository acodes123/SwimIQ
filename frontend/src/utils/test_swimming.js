const KEYPOINT_MAP = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
}

const PHASE = { ENTRY: 'entry', PULL: 'pull', RECOVERY: 'recovery', UNKNOWN: 'unknown' }

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

class StrokeAnalyzer {
  constructor() {
    this.wristHistory = { left: [], right: [] }
    this.shoulderHistory = []
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
    const leftShoulder = getKp(pose, 'leftShoulder')
    const rightShoulder = getKp(pose, 'rightShoulder')

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

    return this.getSnapshot()
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

    if (this.frameCount <= 40) {
      if (side === 'left') {
        console.log(`  [F${String(this.frameCount).padStart(2)}] L avgY=${avgY.toFixed(1)} prevY=${prevAvgY.toFixed(1)} vel=${yVelocity.toFixed(2)} prevPhase=${prevPhase}`)
      }
    }

    if (prevPhase === PHASE.RECOVERY || prevPhase === PHASE.UNKNOWN) {
      if (yVelocity > 0.5) {
        this.currentPhase[side] = PHASE.ENTRY
        if (this.lastStrokeTime[side] !== null && !this.frameStrokeRecorded) {
          const strokeDuration = now - this.lastStrokeTime[side]
          if (this.frameCount <= 40 && side === 'left') {
            console.log(`    -> ENTRY detected! duration=${strokeDuration}ms`)
          }
          if (strokeDuration > 300 && strokeDuration < 5000) {
            this.strokes.push({ side, time: now, duration: strokeDuration })
            console.log(`    *** STROKE RECORDED: ${side} ${strokeDuration}ms ***`)
            this.frameStrokeRecorded = true
          }
        }
        this.lastStrokeTime[side] = now
      }
    } else if (prevPhase === PHASE.ENTRY || prevPhase === PHASE.PULL) {
      if (yVelocity < -0.5) {
        this.currentPhase[side] = PHASE.RECOVERY
      } else {
        this.currentPhase[side] = PHASE.PULL
      }
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
      const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length
      const cv = Math.sqrt(variance) / mean
      consistency = Math.max(0, Math.round(100 - cv * 200))
    }
    const leftStrokes = recentStrokes.filter(s => s.side === 'left')
    const rightStrokes = recentStrokes.filter(s => s.side === 'right')
    let symmetry = 50
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
    return {
      strokeCount: recentStrokes.length, strokeRate, consistency, symmetry,
      avgLeftExtension: avgLeftExt, avgRightExtension: avgRightExt,
      headAlignment: 80, phases: { ...this.currentPhase },
      recentStrokes: recentStrokes.slice(-6),
    }
  }
}

function createPose(overrides = {}) {
  const base = [
    { x: 320, y: 80, score: 0.9 },
    { x: 310, y: 75, score: 0.9 },
    { x: 330, y: 75, score: 0.9 },
    { x: 295, y: 78, score: 0.8 },
    { x: 345, y: 78, score: 0.8 },
    { x: 260, y: 150, score: 0.9 },
    { x: 380, y: 150, score: 0.9 },
    { x: 200, y: 200, score: 0.9 },
    { x: 440, y: 200, score: 0.9 },
    { x: 150, y: 150, score: 0.9 },
    { x: 490, y: 150, score: 0.9 },
    { x: 280, y: 300, score: 0.9 },
    { x: 360, y: 300, score: 0.9 },
    { x: 270, y: 400, score: 0.8 },
    { x: 370, y: 400, score: 0.8 },
    { x: 260, y: 500, score: 0.7 },
    { x: 380, y: 500, score: 0.7 },
  ]
  const idxMap = { leftWrist: 9, rightWrist: 10, leftElbow: 7, rightElbow: 8, leftShoulder: 5, rightShoulder: 6 }
  const keypoints = base.map((kp, i) => ({ ...kp }))
  for (const [name, pos] of Object.entries(overrides)) {
    if (idxMap[name] !== undefined) keypoints[idxMap[name]] = { ...keypoints[idxMap[name]], ...pos }
  }
  return { keypoints }
}

// ========= TEST =========
console.log('=== SwimIQ StrokeAnalyzer Debug Test ===\n')

const analyzer = new StrokeAnalyzer()

const totalFrames = 120
const frames = []
for (let i = 0; i < totalFrames; i++) {
  const t = (i / totalFrames) * Math.PI * 6 // 3 full cycles
  const leftWristY = 200 + Math.sin(t) * 100
  const rightWristY = 200 + Math.sin(t + Math.PI) * 100
  frames.push({ leftWristY, rightWristY })
}

console.log(`Simulating ${totalFrames} frames (3 full swim cycles at simulated 30fps)...\n`)

let fakeTime = Date.now()
const realDateNow = Date.now
Date.now = () => fakeTime

for (let i = 0; i < frames.length; i++) {
  fakeTime += 33
  const f = frames[i]
  const pose = createPose({ leftWrist: { y: f.leftWristY }, rightWrist: { y: f.rightWristY } })
  analyzer.processFrame(pose)
}

Date.now = realDateNow

const final = analyzer.getSnapshot()

console.log('\n========== FINAL RESULTS ==========')
console.log(`Strokes detected:  ${final.strokeCount}`)
console.log(`Stroke rate:       ${final.strokeRate} SPM`)
console.log(`Consistency:       ${final.consistency}%`)
console.log(`Symmetry:          ${final.symmetry}%`)
console.log(`Left arm ext:      ${final.avgLeftExtension}%`)
console.log(`Right arm ext:     ${final.avgRightExtension}%`)
console.log(`Phase:             L=${final.phases.left}, R=${final.phases.right}`)
console.log(`Recent strokes:`)
final.recentStrokes.forEach((s, i) => {
  console.log(`  [${i}] ${s.side.padEnd(5)} ${s.duration}ms`)
})

const score = {
  total: Math.round(final.symmetry * 0.30 + final.consistency * 0.35 + Math.round((final.avgLeftExtension + final.avgRightExtension) / 2) * 0.35),
  symmetry: final.symmetry, consistency: final.consistency,
  extension: Math.round((final.avgLeftExtension + final.avgRightExtension) / 2),
}
console.log(`\n========== SCORE ==========`)
console.log(`TOTAL: ${score.total}/100  Sym=${score.symmetry} Cons=${score.consistency} Ext=${score.extension}`)

console.log('\n========== VERIFICATION ==========')
const checks = [
  ['Strokes detected > 0', final.strokeCount > 0],
  ['Consistency in range', final.consistency >= 0 && final.consistency <= 100],
  ['Symmetry in range', final.symmetry >= 0 && final.symmetry <= 100],
  ['Extensions computed', final.avgLeftExtension > 0 && final.avgRightExtension > 0],
  ['Score in range', score.total >= 0 && score.total <= 100],
]
checks.forEach(([label, pass]) => console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`))
console.log(`\n${checks.every(c => c[1]) ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
