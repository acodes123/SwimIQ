import { Waves, Camera, Upload, Headphones, BarChart3, ArrowRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

function WaveBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Drifting aurora blobs */}
      <div
        className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full opacity-[0.13] blur-3xl animate-aurora"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 65%)' }}
      />
      <div
        className="absolute right-1/4 top-40 h-[400px] w-[400px] rounded-full opacity-[0.10] blur-3xl animate-aurora-slow"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 65%)' }}
      />

      {/* Scrolling water surface along the hero's bottom edge */}
      <div className="absolute inset-x-0 bottom-0 h-40 opacity-40">
        <svg
          className="absolute bottom-6 h-24 w-[200%] animate-wave-scroll-slow text-cyan-500/10"
          viewBox="0 0 1440 100" preserveAspectRatio="none" fill="currentColor"
        >
          <path d="M0,60 C120,90 240,30 360,55 C480,80 600,25 720,50 C840,75 960,30 1080,55 C1200,80 1320,35 1440,60 L1440,100 L0,100 Z" />
          <path d="M1440,60 C1560,90 1680,30 1800,55 C1920,80 2040,25 2160,50 C2280,75 2400,30 2520,55 C2640,80 2760,35 2880,60 L2880,100 L1440,100 Z" transform="translate(0,0)" />
        </svg>
        <svg
          className="absolute bottom-0 h-20 w-[200%] animate-wave-scroll text-cyan-400/15"
          viewBox="0 0 1440 100" preserveAspectRatio="none" fill="currentColor"
        >
          <path d="M0,65 C180,35 360,85 540,60 C720,35 900,80 1080,58 C1260,36 1350,70 1440,65 L1440,100 L0,100 Z" />
          <path d="M1440,65 C1620,35 1800,85 1980,60 C2160,35 2340,80 2520,58 C2700,36 2790,70 2880,65 L2880,100 L1440,100 Z" />
        </svg>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#030712] flex flex-col items-center">

      {/* ===== Hero: fills the viewport ===== */}
      <section className="relative flex min-h-screen w-full flex-col">
        <WaveBackground />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
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
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 hover:shadow-cyan-400/30"
            >
              Live Demo
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pb-24 text-center sm:px-6 lg:px-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-1.5 text-sm font-medium text-cyan-400 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            AI-Powered Swimming Coach
          </div>

          <h1 className="mb-6 text-6xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl">
            Swim
            <span className="animate-shimmer bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">IQ</span>
          </h1>

          <p className="mb-4 max-w-3xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            Your swim coach, powered by computer vision.
          </p>

          <p className="mx-auto mb-12 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Poolside cameras track your stroke. AI analyzes your form in real time.
            Coaching lands in your headphones — while you swim. No goggles. No guesswork.
          </p>

          <div className="flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
            <Link
              to="/demo"
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-9 py-4 text-lg font-bold text-white shadow-xl shadow-cyan-500/30 transition-all hover:from-cyan-400 hover:to-blue-400 hover:shadow-cyan-400/40 animate-pulse-glow"
            >
              <Play className="h-5 w-5" />
              Start Live Demo
            </Link>
            <Link
              to="/upload"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-9 py-4 text-lg font-semibold text-slate-200 backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-white/[0.07] hover:text-white"
            >
              <Upload className="h-5 w-5" />
              Upload a Video
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Coaching-grade analysis, no coach required
          </h2>
          <p className="mx-auto max-w-xl text-slate-500">
            Everything a poolside coach sees — captured, measured, and spoken back to you in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Camera className="h-6 w-6" />}
            title="Poolside Cameras"
            description="Cameras at lane ends capture your full stroke from stable angles — nothing to wear in the water."
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
      </section>

      {/* ===== How It Works ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-10 sm:p-14">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">How it works</h2>
            <p className="text-slate-500">From water to insight in milliseconds</p>
          </div>
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '1', title: 'Capture', desc: 'Poolside cameras record the swimmer from both lane ends' },
              { step: '2', title: 'Detect', desc: 'MoveNet AI tracks 17 body keypoints in real time' },
              { step: '3', title: 'Analyze', desc: 'Form engine scores symmetry, extension, and timing' },
              { step: '4', title: 'Coach', desc: 'Audio tips delivered through headphones as you swim' },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-xl font-black text-cyan-400 shadow-lg shadow-cyan-500/10">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mx-auto max-w-[220px] text-sm leading-relaxed text-slate-500">{item.desc}</p>
                {i < 3 && (
                  <ArrowRight className="absolute -right-7 top-4 hidden h-5 w-5 text-slate-700 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Bottom CTA ===== */}
      <section className="mx-auto max-w-7xl px-4 pb-28 text-center sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to swim smarter?
        </h2>
        <Link
          to="/demo"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-9 py-4 text-lg font-bold text-white shadow-xl shadow-cyan-500/30 transition-all hover:from-cyan-400 hover:to-blue-400 hover:shadow-cyan-400/40"
        >
          Try the Live Demo
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-sm text-slate-600">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4">
          <Waves className="h-4 w-4 text-cyan-500" />
          <span className="font-semibold text-slate-400">SwimIQ</span>
          <span className="text-slate-700">·</span>
          <span>AI swimming coach for every lane</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-white/[0.04] hover:shadow-xl hover:shadow-cyan-500/10">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-cyan-500/20">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}
