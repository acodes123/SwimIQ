import { useState, useRef, useCallback } from 'react'
import SkeletonOverlay from './SkeletonOverlay'
import ScorePanel from './ScorePanel'
import TipsPanel from './TipsPanel'
import { initMoveNet, detectPose } from '../utils/movenet'
import { analyzeFrame, generateTips } from '../utils/analysis'
import { computeScore } from '../utils/scoring'
import { Upload, Loader2, Play, RotateCcw, Waves } from 'lucide-react'

export default function VideoUpload() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [videoSrc, setVideoSrc] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessed, setIsProcessed] = useState(false)
  const [currentPose, setCurrentPose] = useState(null)
  const [finalScore, setFinalScore] = useState(null)
  const [tips, setTips] = useState([])
  const [progress, setProgress] = useState(0)

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
    setIsProcessed(false)
    setFinalScore(null)
    setTips([])
    setCurrentPose(null)
  }, [])

  const processVideo = useCallback(async () => {
    if (!videoRef.current) return
    setIsProcessing(true)
    setProgress(0)

    const video = videoRef.current
    await video.play()

    const detector = await initMoveNet()
    const analyses = []
    const duration = video.duration
    const sampleInterval = 0.2

    let currentTime = 0
    while (currentTime < duration) {
      video.currentTime = currentTime
      await new Promise((r) => {
        video.onseeked = r
      })

      const pose = await detectPose(video)
      if (pose) {
        const frameAnalysis = analyzeFrame(pose)
        analyses.push(frameAnalysis)
        setCurrentPose(pose)
      }

      setProgress(Math.min(100, (currentTime / duration) * 100))
      currentTime += sampleInterval
    }

    if (analyses.length > 0) {
      const avgSymmetry = analyses
        .filter(a => a.symmetry)
        .reduce((s, a, _, arr) => s + a.symmetry.symmetryPct / arr.length, 0) || 70

      const avgAlignment = analyses
        .filter(a => a.alignment)
        .reduce((s, a, _, arr) => s + a.alignment.alignmentScore / arr.length, 0) || 70

      const avgLeft = analyses
        .filter(a => a.leftArm)
        .reduce((s, a, _, arr) => s + a.leftArm.extensionPct / arr.length, 0) || 50

      const avgRight = analyses
        .filter(a => a.rightArm)
        .reduce((s, a, _, arr) => s + a.rightArm.extensionPct / arr.length, 0) || 50

      const score = computeScore({
        symmetry: { symmetryPct: avgSymmetry },
        alignment: { alignmentScore: avgAlignment },
        leftArm: { extensionPct: avgLeft },
        rightArm: { extensionPct: avgRight },
      })
      setFinalScore(score)

      const lastAnalysis = analyses[analyses.length - 1]
      setTips(generateTips(lastAnalysis))
    }

    video.pause()
    setIsProcessing(false)
    setIsProcessed(true)
    setProgress(100)
  }, [])

  const reset = useCallback(() => {
    setVideoSrc(null)
    setIsProcessed(false)
    setFinalScore(null)
    setTips([])
    setCurrentPose(null)
    setProgress(0)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <Waves className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            SwimIQ
          </h1>
          <span className="text-slate-500 text-sm ml-2">Video Analysis</span>
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
                      Analyzing... {Math.round(progress)}%
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
            <ScorePanel score={finalScore} />
            <TipsPanel tips={tips} />
          </div>
        </div>
      </div>
    </div>
  )
}
