import { Waves, Camera, Upload, Headphones, BarChart3, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SwimIQ</span>
        </div>
        <div className="flex gap-3">
          <Link
            to="/demo"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-white hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20 text-sm"
          >
            Live Demo
          </Link>
          <Link
            to="/upload"
            className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-medium text-slate-300 hover:bg-slate-700 transition-all text-sm"
          >
            Upload Video
          </Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-8">
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          AI-Powered Swimming Coach
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
          Real-time form analysis.
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Instant coaching feedback.
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          SwimIQ uses computer vision and AI to analyze your swimming stroke in real-time.
          Poolside cameras track your form. Your phone delivers audio coaching through headphones — while you swim.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          <Link
            to="/demo"
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-white text-lg hover:from-cyan-400 hover:to-blue-400 transition-all shadow-xl shadow-cyan-500/25 animate-pulse-glow flex items-center justify-center gap-2"
          >
            Start Live Demo
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/upload"
            className="px-8 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-semibold text-slate-300 text-lg hover:bg-slate-700/50 transition-all flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Upload a Video
          </Link>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-cyan-500/20 blur-3xl rounded-full" />
          <div className="relative bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Camera className="w-8 h-8" />}
                title="Poolside Cameras"
                description="Two cameras at lane ends capture your full stroke from stable angles"
              />
              <FeatureCard
                icon={<BarChart3 className="w-8 h-8" />}
                title="AI Pose Analysis"
                description="MoveNet tracks 17 body keypoints. Analyzes symmetry, extension, alignment"
              />
              <FeatureCard
                icon={<Headphones className="w-8 h-8" />}
                title="Live Audio Coaching"
                description="Bone conduction headphones deliver instant form corrections while you swim"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-slate-400">From water to insight in milliseconds</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Poolside Camera', desc: 'Captures swimmer from both lane ends' },
            { step: '02', title: 'MoveNet AI', desc: 'Detects 17 body keypoints in real-time' },
            { step: '03', title: 'Form Analysis', desc: 'Computes symmetry, extension, alignment' },
            { step: '04', title: 'Audio Feedback', desc: 'Coaching tips delivered through headphones' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="text-5xl font-black text-cyan-500/20 mb-3">{item.step}</div>
              <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
        SwimIQ — AI Swimming Coach. Built for hackers.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="text-center p-4">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 text-cyan-400">
        {icon}
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}
