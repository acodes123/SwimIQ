import { Waves, Camera, Upload, Headphones, BarChart3, ArrowRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#030712]">

      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/25">
            <Waves className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SwimIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-white sm:block"
          >
            Upload Video
          </Link>
          <Link
            to="/demo"
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400"
          >
            Live Demo
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 text-center sm:px-6 sm:pt-24 lg:px-8">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(ellipse at center, #06b6d4 0%, transparent 60%)' }}
        />

        <div className="relative">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-1.5 text-sm font-medium text-cyan-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            AI-Powered Swimming Coach
          </div>

          <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your swim coach,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              powered by computer vision.
            </span>
          </h1>

          <p className="mx-auto mb-12 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            SwimIQ analyzes your stroke in real time with poolside cameras and AI pose
            detection — then coaches you through your headphones while you swim.
            No goggles. No guesswork.
          </p>

          <div className="mb-24 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/demo"
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-cyan-500/25 transition-all hover:bg-cyan-400 animate-pulse-glow"
            >
              <Play className="h-5 w-5" />
              Start Live Demo
            </Link>
            <Link
              to="/upload"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-semibold text-slate-300 transition-all hover:border-white/25 hover:text-white"
            >
              <Upload className="h-5 w-5" />
              Upload a Video
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Camera className="h-6 w-6" />}
              title="Poolside Cameras"
              description="Two cameras at lane ends capture your full stroke from stable angles — no wearables in the water."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="AI Pose Analysis"
              description="MoveNet tracks 17 body keypoints per frame, scoring symmetry, extension, and stroke consistency."
            />
            <FeatureCard
              icon={<Headphones className="h-6 w-6" />}
              title="Live Audio Coaching"
              description="Bone-conduction headphones deliver instant form corrections mid-lap, while you swim."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">How it works</h2>
          <p className="text-slate-500">From water to insight in milliseconds</p>
        </div>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '01', title: 'Capture', desc: 'Poolside cameras record the swimmer from both lane ends' },
            { step: '02', title: 'Detect', desc: 'MoveNet AI tracks 17 body keypoints in real time' },
            { step: '03', title: 'Analyze', desc: 'Form engine scores symmetry, extension, and timing' },
            { step: '04', title: 'Coach', desc: 'Audio tips delivered through headphones as you swim' },
          ].map((item, i) => (
            <div key={item.step} className="relative text-center">
              <div className="mb-4 text-5xl font-black text-cyan-500/15">{item.step}</div>
              <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mx-auto max-w-[220px] text-sm leading-relaxed text-slate-500">{item.desc}</p>
              {i < 3 && (
                <ArrowRight className="absolute -right-5 top-6 hidden h-5 w-5 text-slate-700 lg:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-10 text-center text-sm text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Waves className="h-4 w-4 text-cyan-500" />
            <span className="font-semibold text-slate-400">SwimIQ</span>
          </div>
          <p>AI swimming coach — real-time form analysis for every lane.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-left transition-colors hover:border-cyan-500/25">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}
