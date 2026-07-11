import { useState, useRef, useCallback } from 'react'
import SkeletonOverlay from './SkeletonOverlay'
import ScorePanel from './ScorePanel'
import TipsPanel from './TipsPanel'
import { initMoveNet, detectPose } from '../utils/movenet'
import { StrokeAnalyzer } from '../utils/swimmingAnalysis'
import { computeScore } from '../utils/scoring'
import { generateTips } from '../utils/tips'
import { analyzeStrokeWithGemini } from '../utils/gemini'
import { useAudioFeedback } from '../hooks/useAudioFeedback'
import { Upload, Loader2, Play, RotateCcw, Volume2, VolumeX, Waves } from 'lucide-react'

export default function VideoUpload() {
  const videoRef = useRef(null)
  const [videoSrc, setVideoSrc] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessed, setIsProcessed] = useState(false)
  const [currentPose, setCurrentPose] = useState(null)
  const [finalScore, setFinalScore] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [tips, setTips] = useState([])
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const lastPoseRef = useRef(null)
  const { isEnabled: audioEnabled, setIsEnabled: setAudioEnabled, speakTips } =
    useAudioFeedback()

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
    setIsProcessed(false)
    setFinalScore(null)
    setSnapshot(null)
    setTips([])
    setCurrentPose(null)
    try {
      const fd = new FormData()
      fd.append('video', file)
      await fetch('/api/upload', { method: 'POST', body: fd })
    } catch (err) {
      console.warn('Upload save failed:', err)
    }
  }, [])

  const processVideo = useCallback(async () => {
    if (!videoRef.current) return
    setIsProcessing(true)
    setProgress(0)

    const video = videoRef.current
    await video.play()
    video.pause()

    const duration = Math.min(video.duration, 60)

    setStatusText('Identifying stroke type with AI...')
    setProgress(10)
    let geminiResult = null
    try {
      geminiResult = await analyzeStrokeWithGemini(video, duration)
    } catch (e) {
      console.warn('Gemini analysis failed, using pose detection fallback:', e)
    }

    setStatusText('Analyzing pose and form...')
    setProgress(30)

    const detector = await initMoveNet()
    const analyzer = new StrokeAnalyzer()
    const sampleInterval = 0.5

    let currentTime = 0
    while (currentTime < duration) {
      video.currentTime = currentTime
      await new Promise((r) => { video.onseeked = r })

      const pose = await detectPose(video)
      if (pose) {
        const snap = analyzer.processFrame(pose)
        lastPoseRef.current = pose
        setCurrentPose(pose)
        setSnapshot(snap)
      }

      setProgress(30 + Math.min(65, (currentTime / duration) * 65))
      currentTime += sampleInterval
    }

    setStatusText('Scoring...')
    setProgress(95)

    const finalSnap = analyzer.getSnapshot(lastPoseRef.current)

    if (geminiResult && geminiResult.stroke && geminiResult.stroke !== 'Detecting...') {
      finalSnap.strokeType = geminiResult.stroke
      finalSnap.strokeConfidence = geminiResult.confidence || 85
    } else if (finalSnap.strokeType === 'Detecting...' || finalSnap.strokeConfidence < 40) {
      finalSnap.strokeType = 'Freestyle'
      finalSnap.strokeConfidence = 50
    }

    if (geminiResult && geminiResult.metrics) {
      const m = geminiResult.metrics
      if (m.symmetry != null) finalSnap.symmetry = m.symmetry
      if (m.extension != null) {
        finalSnap.avgLeftExtension = m.extension
        finalSnap.avgRightExtension = m.extension
      }
      if (m.rotation != null) finalSnap.bodyRotation = m.rotation
      if (m.catchQuality != null) finalSnap.catchQuality = m.catchQuality
    }

    const score = computeScore(finalSnap)
    const newTips = generateTips(finalSnap)

    if (geminiResult && geminiResult.feedback) {
      newTips.unshift({ type: 'info', text: geminiResult.feedback })
    }

    setFinalScore(score)
    setSnapshot(finalSnap)
    setTips(newTips.slice(0, 4))

    if (audioEnabled && newTips.length > 0) {
      speakTips(newTips)
    }

    video.pause()
    setIsProcessing(false)
    setIsProcessed(true)
    setProgress(100)
    setStatusText('')
  }, [audioEnabled, speakTips])

  const reset = useCallback(() => {
    setVideoSrc(null)
    setIsProcessed(false)
    setFinalScore(null)
    setSnapshot(null)
    setTips([])
    setCurrentPose(null)
    setProgress(0)
    setStatusText('')
    lastPoseRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              SwimIQ
            </h1>
            <span className="text-slate-500 text-sm ml-2">Video Analysis</span>
          </div>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            title={audioEnabled ? 'Mute feedback' : 'Enable audio feedback'}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/50 aspect-video">
              {videoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    controls={isProcessed}
                  />
                  {currentPose && (
                    <SkeletonOverlay
                      pose={currentPose}
                      width={videoRef.current?.videoWidth || 1280}
                      height={videoRef.current?.videoHeight || 720}
                    />
                  )}
                </>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <Upload className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-1">
                    Upload Swim Video
                  </h3>
                  <p className="text-slate-500 text-sm">
                    MP4, MOV, or WebM
                  </p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              )}

              {isProcessing && (
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    <span className="text-sm text-slate-300">
                      {statusText} {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {snapshot && snapshot.phases && isProcessing && (
                <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300 flex gap-4">
                  <span>
                    L: <span className="text-cyan-400 font-semibold">{snapshot.phases.left}</span>
                  </span>
                  <span>
                    R: <span className="text-cyan-400 font-semibold">{snapshot.phases.right}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3">
              {videoSrc && !isProcessing && !isProcessed && (
                <button
                  onClick={processVideo}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-white hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Analyze Video
                </button>
              )}
              {(videoSrc || isProcessed) && (
                <button
                  onClick={reset}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-medium text-slate-300 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Video
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <ScorePanel score={finalScore} snapshot={snapshot} />
            <TipsPanel tips={tips} />
          </div>
        </div>
      </div>
    </div>
  )
}
