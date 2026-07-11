export function generateTips(snapshot) {
  if (!snapshot) return []
  const tips = []

  if (snapshot.strokeCount < 2) {
    tips.push({
      type: 'info',
      text: 'Keep moving your arms — detecting stroke patterns...',
    })
    return tips
  }

  // Symmetry
  if (snapshot.symmetry < 60) {
    const weaker = snapshot.avgLeftExtension < snapshot.avgRightExtension ? 'left' : 'right'
    const diff = Math.abs(snapshot.avgLeftExtension - snapshot.avgRightExtension)
    tips.push({
      type: 'warning',
      text: `Your ${weaker} arm extends ${Math.round(diff)}% less than your other arm — try to match both sides`,
    })
  } else if (snapshot.symmetry >= 85) {
    tips.push({
      type: 'success',
      text: 'Great arm symmetry — both sides are balanced',
    })
  }

  // Consistency
  if (snapshot.consistency < 50) {
    tips.push({
      type: 'warning',
      text: 'Stroke timing is inconsistent — try to maintain a steady rhythm',
    })
  } else if (snapshot.consistency >= 80) {
    tips.push({
      type: 'success',
      text: 'Excellent stroke consistency — very steady rhythm',
    })
  }

  // Extension
  if (snapshot.avgLeftExtension < 50 || snapshot.avgRightExtension < 50) {
    tips.push({
      type: 'info',
      text: 'Extend your arms further on entry — reach before you pull',
    })
  }

  // Head alignment
  if (snapshot.headAlignment !== null && snapshot.headAlignment < 60) {
    tips.push({
      type: 'info',
      text: 'Keep your head centered — look down at the pool bottom',
    })
  }

  // Stroke rate
  if (snapshot.strokeRate > 0) {
    if (snapshot.strokeRate < 25) {
      tips.push({
        type: 'info',
        text: `Stroke rate is ${snapshot.strokeRate} SPM — try to speed up slightly`,
      })
    } else if (snapshot.strokeRate > 65) {
      tips.push({
        type: 'info',
        text: `Stroke rate is ${snapshot.strokeRate} SPM — try to slow down and lengthen each stroke`,
      })
    }
  }

  if (tips.length === 0) {
    tips.push({
      type: 'success',
      text: 'Solid form! Keep working on consistency',
    })
  }

  return tips.slice(0, 3)
}
