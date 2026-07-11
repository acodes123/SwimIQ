function computeFrameDiff(ctx, prevData, width, height) {
  const curr = ctx.getImageData(0, 0, width, height)
  if (!prevData) return { diff: 999, data: curr }
  let totalDiff = 0
  const step = 16
  for (let i = 0; i < curr.data.length; i += step * 4) {
    totalDiff += Math.abs(curr.data[i] - prevData.data[i])
      + Math.abs(curr.data[i + 1] - prevData.data[i + 1])
      + Math.abs(curr.data[i + 2] - prevData.data[i + 2])
  }
  const pixels = curr.data.length / (step * 4)
  return { diff: totalDiff / pixels / 3, data: curr }
}

async function seekTo(video, time) {
  video.currentTime = time
  await new Promise((r) => { video.onseeked = r })
}

function captureFrame(video, canvas, ctx) {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
}

export async function analyzeStrokeWithGemini(videoElement, duration) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = 640
  canvas.height = 360

  const cappedDuration = Math.min(duration, 60)

  const probeCount = 20
  const probeInterval = cappedDuration / probeCount
  const motionScores = []

  let prevData = null
  for (let i = 0; i < probeCount; i++) {
    await seekTo(videoElement, i * probeInterval + 0.1)
    const { diff, data } = computeFrameDiff(ctx, prevData, canvas.width, canvas.height)
    motionScores.push({ time: i * probeInterval, motion: diff })
    prevData = data
  }

  const sortedByMotion = [...motionScores].sort((a, b) => b.motion - a.motion)
  const medianMotion = sortedByMotion[Math.floor(sortedByMotion.length / 2)]?.motion || 1
  const activeThreshold = medianMotion * 0.3
  const activeSegments = motionScores.filter(s => s.motion > activeThreshold)

  let swimStart = 0
  let swimEnd = cappedDuration
  if (activeSegments.length >= 4) {
    swimStart = Math.max(0, activeSegments[0].time - 1)
    swimEnd = Math.min(cappedDuration, activeSegments[activeSegments.length - 1].time + 1)
  }

  const sampleCount = 12
  const swimDuration = swimEnd - swimStart
  const interval = swimDuration / sampleCount
  const frames = []

  for (let i = 0; i < sampleCount; i++) {
    const time = swimStart + i * interval + interval * 0.5
    await seekTo(videoElement, Math.min(time, swimEnd - 0.1))
    frames.push(captureFrame(videoElement, canvas, ctx))
  }

  const res = await fetch('/api/analyze-stroke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames }),
  })

  if (!res.ok) throw new Error('Gemini analysis failed')
  return await res.json()
}
