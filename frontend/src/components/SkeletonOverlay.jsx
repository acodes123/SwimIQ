import { useEffect, useRef } from 'react'
import { SKELETON_CONNECTIONS, KEYPOINT_MAP } from '../utils/movenet'

export default function SkeletonOverlay({ pose, width, height, videoWidth, videoHeight }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pose) return

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    const scaleX = width / videoWidth
    const scaleY = height / videoHeight

    const keypoints = pose.keypoints

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)'
    ctx.lineWidth = 3
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
        ctx.moveTo(kpA.x * scaleX, kpA.y * scaleY)
        ctx.lineTo(kpB.x * scaleX, kpB.y * scaleY)
        ctx.stroke()
      }
    })

    ctx.shadowBlur = 0
    keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        const r = kp.score > 0.6 ? 6 : 4
        const sx = kp.x * scaleX
        const sy = kp.y * scaleY
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, 2 * Math.PI)
        ctx.fillStyle = kp.score > 0.6 ? '#06b6d4' : '#0ea5e9'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })
  }, [pose, width, height, videoWidth, videoHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 pointer-events-none"
    />
  )
}
