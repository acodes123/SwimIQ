import { useState, useCallback, useRef, useEffect } from 'react'
import { initMoveNet, detectPose } from '../utils/movenet'
import { StrokeAnalyzer } from '../utils/swimmingAnalysis'
import { computeScore } from '../utils/scoring'

export function usePoseDetection(videoRef, isActive) {
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pose, setPose] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [score, setScore] = useState(null)
  const frameRef = useRef(null)
  const isActiveRef = useRef(isActive)
  const analyzerRef = useRef(new StrokeAnalyzer())

  isActiveRef.current = isActive

  const runLoop = useCallback(async () => {
    if (!isActiveRef.current) return

    try {
      const detectedPose = await detectPose(videoRef.current)
      if (detectedPose && isActiveRef.current) {
        setPose(detectedPose)
        const snap = analyzerRef.current.processFrame(detectedPose)
        setSnapshot(snap)
        setScore(computeScore(snap))
      }
    } catch (err) {
      console.error('Detection error:', err)
    }

    if (isActiveRef.current) {
      frameRef.current = setTimeout(runLoop, 33)
    }
  }, [videoRef])

  const startDetection = useCallback(async () => {
    if (!videoRef.current || !isActiveRef.current) return

    setIsLoading(true)
    setError(null)
    try {
      await initMoveNet()
      setIsModelLoaded(true)
      setIsLoading(false)
      analyzerRef.current.reset()
      runLoop()
    } catch (err) {
      console.error('Failed to init MoveNet:', err)
      setError(err.message || 'Failed to load AI model')
      setIsLoading(false)
    }
  }, [videoRef, runLoop])

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => startDetection(), 100)
      return () => {
        clearTimeout(timer)
        if (frameRef.current) clearTimeout(frameRef.current)
      }
    }
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current)
    }
  }, [isActive, startDetection])

  const stopDetection = useCallback(() => {
    if (frameRef.current) {
      clearTimeout(frameRef.current)
      frameRef.current = null
    }
    setPose(null)
  }, [])

  return {
    isModelLoaded,
    isLoading,
    error,
    pose,
    snapshot,
    score,
    stopDetection,
  }
}
