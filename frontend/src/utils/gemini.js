const VALID_STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly']

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Number(v) || 0))

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

// Seek that can't hang: resolves on 'seeked', or after a timeout if the
// browser never fires the event (e.g. seeking to the current position).
export function seekTo(video, time) {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(time, (video.duration || 0) - 0.05))
    if (!Number.isFinite(target) || Math.abs(video.currentTime - target) < 0.01) {
      resolve()
      return
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', finish)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, 2000)
    video.addEventListener('seeked', finish)
    video.currentTime = target
  })
}

function captureFrame(video, canvas, ctx) {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
}

function normalizeResult(data) {
  if (!data || typeof data !== 'object') return null
  const stroke = VALID_STROKES.includes(data.stroke) ? data.stroke : null
  if (!stroke) return null

  const result = {
    stroke,
    confidence: clamp(data.confidence ?? 75),
    feedback: typeof data.feedback === 'string' ? data.feedback.trim() : '',
  }

  if (data.metrics && typeof data.metrics === 'object') {
    const m = data.metrics
    result.metrics = {}
    if (m.symmetry != null) result.metrics.symmetry = clamp(m.symmetry)
    if (m.extension != null) result.metrics.extension = clamp(m.extension)
    if (m.rotation != null) result.metrics.rotation = clamp(m.rotation)
    if (m.catchQuality != null) result.metrics.catchQuality = clamp(m.catchQuality)
  }

  return result
}

export async function analyzeStrokeWithGemini(videoElement, duration) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = 640
  canvas.height = 360

  const cappedDuration = Math.min(duration, 60)
  if (!Number.isFinite(cappedDuration) || cappedDuration <= 0) {
    throw new Error('Invalid video duration')
  }

  // Probe motion levels to find the active swimming segment.
  const probeCount = Math.min(20, Math.max(4, Math.floor(cappedDuration * 2)))
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
  const swimDuration = Math.max(0.5, swimEnd - swimStart)
  const interval = swimDuration / sampleCount
  const frames = []

  for (let i = 0; i < sampleCount; i++) {
    const time = swimStart + i * interval + interval * 0.5
    await seekTo(videoElement, Math.min(time, swimEnd - 0.1))
    const frame = captureFrame(videoElement, canvas, ctx)
    if (frame) frames.push(frame)
  }

  if (frames.length === 0) {
    throw new Error('Could not capture frames from video')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  let res
  try {
    const apiBase = import.meta.env.VITE_API_URL || ''
    res = await fetch(`${apiBase}/api/analyze-stroke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    let message = 'AI stroke analysis failed'
    try {
      const err = await res.json()
      if (err.error) message = err.error
    } catch { /* non-JSON error body */ }
    throw new Error(message)
  }

  const data = await res.json()
  return normalizeResult(data)
}
