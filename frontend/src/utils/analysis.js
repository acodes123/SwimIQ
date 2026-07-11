import { KEYPOINT_MAP } from './movenet'

function getKeypoint(pose, name) {
  const idx = KEYPOINT_MAP[name]
  return pose.keypoints[idx]
}

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function angleBetween(a, vertex, b) {
  const va = { x: a.x - vertex.x, y: a.y - vertex.y }
  const vb = { x: b.x - vertex.x, y: b.y - vertex.y }
  const dot = va.x * vb.x + va.y * vb.y
  const magA = Math.sqrt(va.x ** 2 + va.y ** 2)
  const magB = Math.sqrt(vb.x ** 2 + vb.y ** 2)
  if (magA === 0 || magB === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
  return (Math.acos(cosAngle) * 180) / Math.PI
}

export function computeArmExtension(pose, side) {
  const capSide = side === 'left' ? 'left' : 'right'
  const shoulder = getKeypoint(pose, `${capSide}Shoulder`)
  const elbow = getKeypoint(pose, `${capSide}Elbow`)
  const wrist = getKeypoint(pose, `${capSide}Wrist`)

  if (!shoulder || !elbow || !wrist) return null
  if (shoulder.score < 0.3 || elbow.score < 0.3 || wrist.score < 0.3) return null

  const angle = angleBetween(shoulder, elbow, wrist)
  const extensionPct = Math.max(0, Math.min(100, ((angle - 30) / 150) * 100))
  return { angle, extensionPct }
}

export function computeStrokeSymmetry(pose) {
  const leftArm = computeArmExtension(pose, 'left')
  const rightArm = computeArmExtension(pose, 'right')

  if (!leftArm || !rightArm) return null

  const diff = Math.abs(leftArm.extensionPct - rightArm.extensionPct)
  const symmetryPct = Math.max(0, 100 - diff)

  return {
    symmetryPct,
    leftExtension: leftArm.extensionPct,
    rightExtension: rightArm.extensionPct,
    leftAngle: leftArm.angle,
    rightAngle: rightArm.angle,
  }
}

export function computeBodyAlignment(pose) {
  const leftShoulder = getKeypoint(pose, 'leftShoulder')
  const rightShoulder = getKeypoint(pose, 'rightShoulder')
  const leftHip = getKeypoint(pose, 'leftHip')
  const rightHip = getKeypoint(pose, 'rightHip')

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null
  if (leftShoulder.score < 0.3 || rightShoulder.score < 0.3 ||
      leftHip.score < 0.3 || rightHip.score < 0.3) return null

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
  const hipMidY = (leftHip.y + rightHip.y) / 2
  const verticalDiff = Math.abs(shoulderMidY - hipMidY)

  const shoulderWidth = distance(leftShoulder, rightShoulder)
  const alignmentScore = Math.max(0, Math.min(100, 100 - (verticalDiff / shoulderWidth) * 200))

  return { alignmentScore, verticalDiff, shoulderWidth }
}

export function computeHeadPosition(pose) {
  const nose = getKeypoint(pose, 'nose')
  const leftShoulder = getKeypoint(pose, 'leftShoulder')
  const rightShoulder = getKeypoint(pose, 'rightShoulder')

  if (!nose || !leftShoulder || !rightShoulder) return null
  if (nose.score < 0.3 || leftShoulder.score < 0.3 || rightShoulder.score < 0.3) return null

  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
  const offset = Math.abs(nose.x - shoulderMidX)
  const shoulderWidth = distance(leftShoulder, rightShoulder)

  const headScore = Math.max(0, Math.min(100, 100 - (offset / shoulderWidth) * 200))

  return { headScore, offset, centered: offset < shoulderWidth * 0.15 }
}

export function analyzeFrame(pose) {
  const symmetry = computeStrokeSymmetry(pose)
  const alignment = computeBodyAlignment(pose)
  const head = computeHeadPosition(pose)
  const leftArm = computeArmExtension(pose, 'left')
  const rightArm = computeArmExtension(pose, 'right')

  return {
    symmetry,
    alignment,
    head,
    leftArm,
    rightArm,
    timestamp: Date.now(),
  }
}

export function generateTips(analysis) {
  const tips = []

  if (analysis.symmetry) {
    const diff = Math.abs(analysis.symmetry.leftExtension - analysis.symmetry.rightExtension)
    if (diff > 15) {
      const weaker = analysis.symmetry.leftExtension < analysis.symmetry.rightExtension ? 'left' : 'right'
      tips.push({
        type: 'warning',
        text: `Your ${weaker} arm extension is ${Math.round(diff)}% shorter than your ${weaker === 'left' ? 'right' : 'left'} arm`,
      })
    }
  }

  if (analysis.leftArm && analysis.leftArm.extensionPct < 60) {
    tips.push({
      type: 'info',
      text: 'Extend your left arm more fully before the pull phase',
    })
  }

  if (analysis.rightArm && analysis.rightArm.extensionPct < 60) {
    tips.push({
      type: 'info',
      text: 'Extend your right arm more fully before the pull phase',
    })
  }

  if (analysis.alignment && analysis.alignment.alignmentScore < 65) {
    tips.push({
      type: 'warning',
      text: 'Try to keep your body more aligned — avoid dropping your hips',
    })
  }

  if (analysis.head && !analysis.head.centered) {
    tips.push({
      type: 'info',
      text: 'Keep your head more centered and look down at the pool bottom',
    })
  }

  if (tips.length === 0) {
    tips.push({
      type: 'success',
      text: 'Good form! Focus on maintaining consistent stroke rate',
    })
  }

  return tips.slice(0, 3)
}
