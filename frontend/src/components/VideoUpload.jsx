import { useState, useRef, useCallback } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import SkeletonOverlay from './SkeletonOverlay'
import ScorePanel from './ScorePanel'
import TipsPanel from './TipsPanel'
import ChatBot from './ChatBot'
import { initMoveNet, detectPose } from '../utils/movenet'
import { StrokeAnalyzer } from '../utils/swimmingAnalysis'
import { computeScore } from '../utils/scoring'
import { generateTips } from '../utils/tips'
import { analyzeStrokeWithGemini, seekTo } from '../utils/gemini'
import { useAudioFeedback } from '../hooks/useAudioFeedback'
import {
  Upload, Loader2, Play, RotateCcw, Volume2, VolumeX,
  Waves, Link, ArrowLeft, AlertTriangle,
} from 'lucide-react'

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
  const [errorText, setErrorText] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const lastPoseRef = useRef(null)
  const { isEnabled: audioEnabled, setIsEnabled: setAudioEnabled, speakTips } =
    useAudioFeedback()

  const setVideoUrl = useCallback((url) => {
    setVideoSrc(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }, [])

  const resetAnalysisState = useCallback(() => {
    setIsProcessed(false)
    setFinalScore(null)
    setSnapshot(null)
    setTips([])
    setCurrentPose(null)
    setProgress(0)
    setStatusText('')
    setErrorText('')
    lastPoseRef.current = null
  }, [])

  // Analysis runs fully client-side — the file never needs to reach a
  // server (hosted platforms also cap request bodies well below video size).
  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoUrl(URL.createObjectURL(file))
    resetAnalysisState()
  }, [setVideoUrl, resetAnalysisState])

  const handleYoutube = useCallback(async () => {
    if (!youtubeUrl.trim() || isDownloading) return
    setIsDownloading(true)
    setErrorText('')
    const apiBase = import.meta.env.VITE_API_URL || ''
    try {
      const res = await fetch(`${apiBase}/api/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      })
      if (!res.ok) {
        let message = 'Unknown error'
        try {
          const err = await res.json()
          message = err.error || message
        } catch { /* non-JSON body */ }
        setErrorText('Download failed: ' + message)
        return
      }
      const blobRes = await fetch(`${apiBase}/api/video-file?` + Date.now())
      if (!blobRes.ok) {
        setErrorText('Could not load downloaded video.')
        return
      }
      const blob = await blobRes.blob()
      setVideoUrl(URL.createObjectURL(blob))
      resetAnalysisState()
    } catch (err) {
      setErrorText('Download failed: ' + err.message)
    } finally {
      setIsDownloading(false)
    }
  }, [youtubeUrl, isDownloading, setVideoUrl, resetAnalysisState])

  const processVideo = useCallback(async () => {
    const video = videoRef.current
    if (!video || isProcessing) return

    setIsProcessing(true)
    setErrorText('')
    setProgress(0)

    try {
      // Make sure metadata is loaded so duration is known.
      if (video.readyState < 1) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Video failed to load')), 10000)
          video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve() }, { once: true })
          video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Video failed to load')) }, { once: true })
        })
      }

      try {
        await video.play()
        video.pause()
      } catch { /* autoplay restrictions — seeking still works */ }

      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        throw new Error('Could not read video duration. Try a different file format (MP4 recommended).')
      }
      if (video.duration < 1) {
        throw new Error('Video is too short to analyze. Upload at least a few seconds of swimming.')
      }

      const duration = Math.min(video.duration, 60)

      // Step 1: AI vision (Groq) is the primary stroke identifier.
      setStatusText('Identifying stroke with AI vision…')
      setProgress(8)
      let aiResult = null
      try {
        aiResult = await analyzeStrokeWithGemini(video, duration)
      } catch (e) {
        console.warn('AI vision analysis failed, falling back to pose detection:', e)
      }

      // Step 2: MoveNet pose analysis for stroke mechanics.
      setStatusText('Analyzing pose and form…')
      setProgress(30)

      await initMoveNet()
      const analyzer = new StrokeAnalyzer()
      const sampleInterval = 0.5
      let poseFrames = 0

      for (let currentTime = 0; currentTime < duration; currentTime += sampleInterval) {
        await seekTo(video, currentTime)

        try {
          const pose = await detectPose(video)
          if (pose) {
            poseFrames++
            // Pass video time so stroke durations/rates reflect the video,
            // not how fast frames were processed.
            const snap = analyzer.processFrame(pose, video.currentTime * 1000)
            lastPoseRef.current = pose
            setCurrentPose(pose)
            setSnapshot(snap)
          }
        } catch (e) {
          console.warn('Pose detection failed on frame at', currentTime, e)
        }

        setProgress(30 + Math.min(60, (currentTime / duration) * 60))
      }

      // Step 3: Combine results and score.
      setStatusText('Scoring…')
      setProgress(95)

      const finalSnap = analyzer.getSnapshot(lastPoseRef.current)

      // Groq vision is the primary stroke identifier; MoveNet is the fallback.
      if (aiResult && aiResult.stroke) {
        finalSnap.strokeType = aiResult.stroke
        finalSnap.strokeConfidence = aiResult.confidence || 85
      } else if (finalSnap.strokeType === 'Detecting...' || finalSnap.strokeConfidence < 40) {
        finalSnap.strokeType = 'Freestyle'
        finalSnap.strokeConfidence = 50
      }

      if (aiResult && aiResult.metrics) {
        const m = aiResult.metrics
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

      if (aiResult && aiResult.feedback) {
        newTips.unshift({ type: 'info', text: aiResult.feedback })
      }
      if (poseFrames === 0 && !aiResult) {
        throw new Error('No swimmer detected in the video. Make sure the swimmer is clearly visible.')
      }
      if (poseFrames === 0) {
        newTips.push({
          type: 'warning',
          text: 'Pose tracking could not lock onto the swimmer — metrics are based on AI vision only.',
        })
      }

      const finalTips = newTips.slice(0, 4)
      setFinalScore(score)
      setSnapshot(finalSnap)
      setTips(finalTips)
      setIsProcessed(true)
      setProgress(100)

      if (audioEnabled && finalTips.length > 0) {
        speakTips(finalTips)
      }
    } catch (err) {
      console.error('Video processing failed:', err)
      setErrorText(err.message || 'Video analysis failed. Please try again.')
      setProgress(0)
    } finally {
      videoRef.current?.pause()
      setIsProcessing(false)
      setStatusText('')
    }
  }, [audioEnabled, speakTips, isProcessing])

  const reset = useCallback(() => {
    setVideoUrl(null)
    resetAnalysisState()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [setVideoUrl, resetAnalysisState])

  return (
    <div className="min-h-screen bg-[#030712]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <RouterLink
              to="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-400"
              title="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </RouterLink>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">SwimIQ</h1>
                <p className="text-xs text-slate-500">Video Analysis</p>
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
              {videoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className="h-full w-full object-contain"
                    playsInline
                    muted
                    controls={isProcessed}
                  />
                  {currentPose && (
                    <SkeletonOverlay
                      pose={currentPose}
                      videoWidth={videoRef.current?.videoWidth}
                      videoHeight={videoRef.current?.videoHeight}
                    />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 sm:p-10">
                  <label className="flex w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 px-6 py-10 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/[0.04]">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10">
                      <Upload className="h-7 w-7 text-cyan-400" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-white">
                      Upload swim video
                    </h3>
                    <p className="text-sm text-slate-500">MP4, MOV, or WebM · up to 60s analyzed</p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex w-full max-w-md items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs uppercase tracking-wider text-slate-600">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="flex w-full max-w-md items-center gap-3">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors focus-within:border-cyan-500/50">
                      <Link className="h-4 w-4 shrink-0 text-slate-500" />
                      <input
                        type="url"
                        placeholder="Paste a YouTube URL…"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleYoutube()}
                        className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                      />
                    </div>
                    <button
                      onClick={handleYoutube}
                      disabled={!youtubeUrl.trim() || isDownloading}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isDownloading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Play className="h-4 w-4" />}
                      {isDownloading ? 'Fetching…' : 'Fetch'}
                    </button>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#030712]/90 p-5 backdrop-blur-md">
                  <div className="mb-3 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    <span className="text-sm text-slate-300">{statusText}</span>
                    <span className="ml-auto text-sm font-semibold text-cyan-400">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {snapshot && snapshot.phases && isProcessing && (
                <div className="absolute right-4 top-4 flex gap-4 rounded-lg border border-white/10 bg-[#030712]/80 px-3 py-2 text-xs text-slate-300 backdrop-blur-sm">
                  <span>L: <span className="font-semibold text-cyan-400">{snapshot.phases.left}</span></span>
                  <span>R: <span className="font-semibold text-cyan-400">{snapshot.phases.right}</span></span>
                </div>
              )}
            </div>

            {errorText && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {errorText}
              </div>
            )}

            <div className="flex justify-center gap-3">
              {videoSrc && !isProcessing && !isProcessed && (
                <button
                  onClick={processVideo}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"
                >
                  <Play className="h-4 w-4" />
                  Analyze Video
                </button>
              )}
              {(videoSrc || isProcessed) && !isProcessing && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 font-medium text-slate-300 transition-all hover:border-white/25"
                >
                  <RotateCcw className="h-4 w-4" />
                  New Video
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <ScorePanel score={finalScore} snapshot={snapshot} />
            <TipsPanel tips={tips} />
          </div>
        </div>
      </div>

      {isProcessed && finalScore && (
        <ChatBot
          context={{
            strokeType: snapshot?.strokeType,
            strokeConfidence: snapshot?.strokeConfidence,
            symmetry: finalScore.symmetry,
            extension: finalScore.extension,
            rotation: snapshot?.bodyRotation,
            catchQuality: snapshot?.catchQuality,
            feedback: tips.map(t => t.text).join(' | ') || undefined,
          }}
        />
      )}
    </div>
  )
}
