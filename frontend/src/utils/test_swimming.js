// Synthetic tests for the real StrokeAnalyzer.
// Run with: node src/utils/test_swimming.js (from frontend/)
import { StrokeAnalyzer } from './swimmingAnalysis.js'
import { KEYPOINT_MAP } from './keypoints.js'

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
  const keypoints = base.map(kp => ({ ...kp }))
  for (const [name, pos] of Object.entries(overrides)) {
    if (KEYPOINT_MAP[name] !== undefined) {
      keypoints[KEYPOINT_MAP[name]] = { ...keypoints[KEYPOINT_MAP[name]], ...pos }
    }
  }
  return { keypoints }
}

let allPass = true
function check(name, condition, detail) {
  const pass = Boolean(condition)
  allPass &&= pass
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  if (detail) console.log(`  ${detail}`)
  return pass
}

// Simulates a swim and returns the final snapshot.
// intervalMs controls sampling: 33 = live 30fps, 500 = uploaded video frames.
function simulate({ leftFn, rightFn, noseY = 250, hipYFn = null, frames = 120, intervalMs = 33 }) {
  const analyzer = new StrokeAnalyzer()
  let snap = null
  for (let i = 0; i < frames; i++) {
    const timestamp = i * intervalMs
    const overrides = {
      leftWrist: { y: leftFn(i * intervalMs / 1000) },
      rightWrist: { y: rightFn(i * intervalMs / 1000) },
      nose: { y: noseY },
      leftShoulder: { y: 150 },
      rightShoulder: { y: 150 },
      leftHip: { y: hipYFn ? hipYFn(i * intervalMs / 1000) : 300 },
      rightHip: { y: hipYFn ? hipYFn(i * intervalMs / 1000) : 300 },
    }
    snap = analyzer.processFrame(createPose(overrides), timestamp)
  }
  return snap
}

// Wrist Y oscillation: one full stroke cycle every `period` seconds.
const wave = (period, amplitude = 100, phaseShift = 0) =>
  (tSec) => 200 + amplitude * Math.sin((tSec / period) * Math.PI * 2 + phaseShift)

console.log('=== SwimIQ Stroke Analyzer Tests ===\n')

console.log('--- Stroke type detection (live, 30fps) ---')
{
  const snap = simulate({ leftFn: wave(1.3), rightFn: wave(1.3, 100, Math.PI), noseY: 250 })
  check('Freestyle (alternating arms, face down)', snap.strokeType === 'Freestyle',
    `Detected: ${snap.strokeType} (${snap.strokeConfidence}%)`)
}
{
  const snap = simulate({ leftFn: wave(1.3), rightFn: wave(1.3, 100, Math.PI), noseY: 80 })
  check('Backstroke (alternating arms, face up)', snap.strokeType === 'Backstroke',
    `Detected: ${snap.strokeType} (${snap.strokeConfidence}%)`)
}
{
  const snap = simulate({ leftFn: wave(1.6, 80), rightFn: wave(1.6, 80), noseY: 250 })
  check('Breaststroke (arms together, flat body)', snap.strokeType === 'Breaststroke',
    `Detected: ${snap.strokeType} (${snap.strokeConfidence}%)`)
}
{
  const snap = simulate({
    leftFn: wave(1.3), rightFn: wave(1.3), noseY: 250,
    hipYFn: (tSec) => 300 + 40 * Math.sin((tSec / 1.3) * Math.PI * 2 + 1),
  })
  check('Butterfly (arms together, undulating body)', snap.strokeType === 'Butterfly',
    `Detected: ${snap.strokeType} (${snap.strokeConfidence}%)`)
}

console.log('\n--- Stroke counting (live, 30fps) ---')
{
  // 4s of swimming at a 1.3s cycle ≈ 3 cycles per arm.
  const snap = simulate({ leftFn: wave(1.3), rightFn: wave(1.3, 100, Math.PI), frames: 120, intervalMs: 33 })
  check('Detects strokes at 30fps', snap.strokeCount >= 3,
    `strokeCount=${snap.strokeCount}, strokeRate=${snap.strokeRate} SPM`)
  check('Stroke rate plausible at 30fps', snap.strokeRate >= 40 && snap.strokeRate <= 140,
    `strokeRate=${snap.strokeRate} SPM`)
}

console.log('\n--- Stroke counting (uploaded video, 0.5s sampling) ---')
{
  // 30s of video sampled every 0.5s, 2s stroke cycle: ~14 cycles per arm.
  const snap = simulate({ leftFn: wave(2), rightFn: wave(2, 100, Math.PI), frames: 60, intervalMs: 500 })
  check('Detects strokes from sampled frames', snap.strokeCount >= 5,
    `strokeCount=${snap.strokeCount}, strokeRate=${snap.strokeRate} SPM`)
  check('Stroke rate plausible for sampled video', snap.strokeRate >= 30 && snap.strokeRate <= 90,
    `strokeRate=${snap.strokeRate} SPM (expected ~60 for a 2s cycle, both arms)`)
  check('Stroke type still detected from sampled frames', snap.strokeType === 'Freestyle',
    `Detected: ${snap.strokeType} (${snap.strokeConfidence}%)`)
}
{
  // Breaststroke sampled at 0.5s with a slower 2.5s cycle.
  const snap = simulate({ leftFn: wave(2.5, 80), rightFn: wave(2.5, 80), frames: 60, intervalMs: 500 })
  check('Breaststroke strokes counted from sampled frames', snap.strokeCount >= 4,
    `strokeCount=${snap.strokeCount}, type=${snap.strokeType}`)
}

console.log('\n--- Edge cases ---')
{
  const analyzer = new StrokeAnalyzer()
  const snap = analyzer.getSnapshot(null)
  check('getSnapshot(null) does not crash', snap && snap.headAlignment === null)
}
{
  // Stationary swimmer: no strokes should be invented.
  const snap = simulate({ leftFn: () => 200, rightFn: () => 200, frames: 60, intervalMs: 500 })
  check('No phantom strokes when stationary', snap.strokeCount === 0,
    `strokeCount=${snap.strokeCount}`)
}

console.log(`\n${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
process.exit(allPass ? 0 : 1)
