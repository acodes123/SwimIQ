import { useEffect, useRef } from 'react'
import { SKELETON_CONNECTIONS, KEYPOINT_MAP } from '../utils/movenet'

// Draws the pose skeleton in native video coordinates on a canvas whose
// buffer matches the video resolution. The canvas is styled with the same
// object-contain fit as the <video>, so keypoints stay aligned at any
// display size without manual scale math.
export default function SkeletonOverlay({ pose, videoWidth, videoHeight }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const w = videoWidth || 1280
    const h = videoHeight || 720
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    if (!pose || !pose.keypoints) return

    const keypoints = pose.keypoints

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)'
    ctx.lineWidth = Math.max(2, w / 320)
    ctx.shadowColor = 'rgba(6, 182, 212, 0.5)'
    ctx.shadowBlur = 8

    SKELETON_CONNECTIONS.forEach(([a, b]) => {
      const idxA = KEYPOINT_MAP[a]
      const idxB = KEYPOINT_MAP[b]
      if (idxA === undefined || idxB === undefined) return
      const kpA = keypoints[idxA]
      const kpB = keypoints[idxB]
      if (kpA && kpB && kpA.score > 0.3 && kpB.score > 0.3) {
        ctx.beginPath()
        ctx.moveTo(kpA.x, kpA.y)
        ctx.lineTo(kpB.x, kpB.y)
        ctx.stroke()
      }
    })

    ctx.shadowBlur = 0
    const dotR = Math.max(3, w / 260)
    keypoints.forEach((kp) => {
      if (kp && kp.score > 0.3) {
        const r = kp.score > 0.6 ? dotR * 1.4 : dotR
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = kp.score > 0.6 ? '#06b6d4' : '#0ea5e9'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    })
  }, [pose, videoWidth, videoHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 h-full w-full object-contain pointer-events-none"
    />
  )
}
