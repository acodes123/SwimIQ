import { useState, useRef, useCallback, useEffect } from 'react'
import SkeletonOverlay from './SkeletonOverlay'
import ScorePanel from './ScorePanel'
import TipsPanel from './TipsPanel'
import { usePoseDetection } from '../hooks/usePoseDetection'
import { useAudioFeedback } from '../hooks/useAudioFeedback'
import { generateTips } from '../utils/tips'
import { VideoOff, Volume2, VolumeX, Loader2, Waves, AlertTriangle, Camera } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LiveDemo() {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [stream, setStream] = useState(null)
  const [displaySize, setDisplaySize] = useState({ width: 640, height: 360 })

  const { isModelLoaded, isLoading, error: modelError, pose, snapshot, score, stopDetection } =
    usePoseDetection(videoRef, isActive)

  const { isEnabled: audioEnabled, setIsEnabled: setAudioEnabled, speakTips, stop: stopAudio } =
    useAudioFeedback()

  const tips = snapshot ? generateTips(snapshot) : []

  useEffect(() => {
    if (audioEnabled && tips.length > 0) {
      speakTips(tips)
    }
  }, [tips, audioEnabled, speakTips])

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDisplaySize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              SwimIQ
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              title={audioEnabled ? 'Mute feedback' : 'Enable audio feedback'}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div ref={containerRef} className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/50 aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {pose && (
                <SkeletonOverlay
                  pose={pose}
                  width={displaySize.width}
                  height={displaySize.height}
                  videoWidth={videoRef.current?.videoWidth || 640}
                  videoHeight={videoRef.current?.videoHeight || 360}
                />
              )}

              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                  <Waves className="w-16 h-16 text-cyan-400 mb-4 animate-wave" />
                  <h2 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h2>
                  <p className="text-slate-400 text-sm mb-6 text-center max-w-sm px-4">
                    Point camera at yourself standing or doing swimming motions.
                    Move your arms in a swimming pattern for best results.
                  </p>
                  {cameraError || modelError ? (
                    <div className="text-center space-y-3 px-4">
                      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
                      <p className="text-amber-400 text-sm max-w-sm">{cameraError || modelError}</p>
                      <button
                        onClick={startCamera}
                        className="px-6 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-slate-300 font-medium hover:bg-slate-700 transition-all flex items-center gap-2 mx-auto"
                      >
                        <Camera className="w-4 h-4" /> Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-white hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25 animate-pulse-glow"
                    >
                      Start Analysis
                    </button>
                  )}
                </div>
              )}

              {isActive && (
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  {isLoading && (
                    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-cyan-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading AI...
                    </div>
                  )}
                  {isModelLoaded && (
                    <div className="bg-emerald-500/20 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-emerald-400">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      Live
                    </div>
                  )}
                </div>
              )}

              {snapshot && snapshot.phases && (
                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300 flex gap-4">
                  <span>
                    L: <span className="text-cyan-400 font-semibold">{snapshot.phases.left}</span>
                  </span>
                  <span>
                    R: <span className="text-cyan-400 font-semibold">{snapshot.phases.right}</span>
                  </span>
                </div>
              )}
            </div>

            {isActive && (
              <div className="flex justify-center">
                <button
                  onClick={stopCamera}
                  className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-medium transition-all"
                >
                  Stop Analysis
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <ScorePanel score={score} snapshot={snapshot} />
            <TipsPanel tips={tips} />
          </div>
        </div>
      </div>
    </div>
  )
}
