import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SkeletonOverlay from './SkeletonOverlay'
import ScorePanel from './ScorePanel'
import TipsPanel from './TipsPanel'
import ChatBot from './ChatBot'
import { usePoseDetection } from '../hooks/usePoseDetection'
import { useAudioFeedback } from '../hooks/useAudioFeedback'
import { generateTips } from '../utils/tips'
import {
  Volume2, VolumeX, Loader2, Waves, AlertTriangle, Camera, ArrowLeft, Square,
} from 'lucide-react'

export default function LiveDemo() {
  const videoRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [stream, setStream] = useState(null)

  const { isModelLoaded, isLoading, error: modelError, pose, snapshot, score, stopDetection } =
    usePoseDetection(videoRef, isActive)

  const { isEnabled: audioEnabled, setIsEnabled: setAudioEnabled, speakTips, stop: stopAudio } =
    useAudioFeedback()

  const tips = useMemo(() => (snapshot ? generateTips(snapshot) : []), [snapshot])

  useEffect(() => {
    if (audioEnabled && tips.length > 0) {
      speakTips(tips)
    }
  }, [tips, audioEnabled, speakTips])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      let mediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      }
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }
      setIsActive(true)
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError(err.message || 'Camera access denied')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
    stopDetection()
    stopAudio()
    setIsActive(false)
  }, [stream, stopDetection, stopAudio])

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [stream])

  return (
    <div className="min-h-screen bg-[#030712]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-400"
              title="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">SwimIQ</h1>
                <p className="text-xs text-slate-500">Live Analysis</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:border-cyan-500/40"
            title={audioEnabled ? 'Mute feedback' : 'Enable audio feedback'}
          >
            {audioEnabled
              ? <Volume2 className="h-5 w-5 text-cyan-400" />
              : <VolumeX className="h-5 w-5 text-slate-500" />}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">

            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                playsInline
                muted
              />

              {pose && (
                <SkeletonOverlay
                  pose={pose}
                  videoWidth={videoRef.current?.videoWidth}
                  videoHeight={videoRef.current?.videoHeight}
                />
              )}

              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/95 p-6">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10">
                    <Waves className="h-8 w-8 text-cyan-400 animate-wave" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold text-white">Ready to analyze</h2>
                  <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-slate-500">
                    Point the camera at yourself and move your arms in a swimming
                    pattern. SwimIQ tracks your stroke in real time.
                  </p>
                  {cameraError || modelError ? (
                    <div className="space-y-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="max-w-sm">{cameraError || modelError}</span>
                      </div>
                      <button
                        onClick={startCamera}
                        className="mx-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 font-medium text-slate-300 transition-all hover:border-white/25"
                      >
                        <Camera className="h-4 w-4" /> Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 animate-pulse-glow"
                    >
                      <Camera className="h-4 w-4" />
                      Start Analysis
                    </button>
                  )}
                </div>
              )}

              {isActive && (
                <div className="absolute left-4 top-4 flex items-center gap-3">
                  {isLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#030712]/80 px-3 py-2 text-sm text-cyan-400 backdrop-blur-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading AI…
                    </div>
                  )}
                  {isModelLoaded && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400 backdrop-blur-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                      Live
                    </div>
                  )}
                </div>
              )}

              {isActive && snapshot && snapshot.phases && (
                <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg border border-white/10 bg-[#030712]/80 px-3 py-2 text-xs text-slate-300 backdrop-blur-sm">
                  <span>L: <span className="font-semibold text-cyan-400">{snapshot.phases.left}</span></span>
                  <span>R: <span className="font-semibold text-cyan-400">{snapshot.phases.right}</span></span>
                </div>
              )}
            </div>

            {isActive && (
              <div className="flex justify-center">
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 font-medium text-red-400 transition-all hover:bg-red-500/20"
                >
                  <Square className="h-4 w-4" />
                  Stop Analysis
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <ScorePanel score={score} snapshot={snapshot} />
            <TipsPanel tips={tips} />
          </div>
        </div>
      </div>

      {isModelLoaded && snapshot && (
        <ChatBot
          context={{
            strokeType: snapshot.strokeType,
            strokeConfidence: snapshot.strokeConfidence,
            symmetry: score?.symmetry,
            extension: score?.extension,
            rotation: snapshot.bodyRotation,
            catchQuality: snapshot.catchQuality,
            feedback: tips.map(t => t.text).join(' | ') || undefined,
          }}
        />
      )}
    </div>
  )
}
