const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v))

export function computeScore(snapshot) {
  if (!snapshot) {
    return { total: 0, symmetry: 0, consistency: 0, extension: 0, strokeRate: 0, strokeCount: 0 }
  }

  const symmetry = clamp(Math.round(snapshot.symmetry ?? 50))
  const consistency = clamp(Math.round(snapshot.consistency ?? 50))
  const leftExt = snapshot.avgLeftExtension ?? 50
  const rightExt = snapshot.avgRightExtension ?? 50
  const extension = clamp(Math.round((leftExt + rightExt) / 2))

  const total = Math.round(
    symmetry * 0.30 +
    consistency * 0.35 +
    extension * 0.35
  )

  return {
    total: clamp(total),
    symmetry,
    consistency,
    extension,
    strokeRate: snapshot.strokeRate ?? 0,
    strokeCount: snapshot.strokeCount ?? 0,
  }
}

export function getScoreColor(score) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 70) return 'text-cyan-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export function getScoreLabel(score) {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Needs Work'
  return 'Keep Practicing'
}

export function getScoreGradient(score) {
  if (score >= 85) return 'from-emerald-500 to-emerald-400'
  if (score >= 70) return 'from-cyan-500 to-blue-400'
  if (score >= 50) return 'from-amber-500 to-orange-400'
  return 'from-red-500 to-red-400'
}
