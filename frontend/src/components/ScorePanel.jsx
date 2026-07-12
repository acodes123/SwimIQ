import { getScoreLabel } from '../utils/scoring'
import { Activity } from 'lucide-react'

function ringColor(score) {
  if (score >= 85) return '#34d399'
  if (score >= 70) return '#22d3ee'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function ScoreRing({ score }) {
  const size = 160
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = ringColor(score)

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.2, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black text-white animate-score-in">{score}</span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  )
}

function MetricBar({ label, value }) {
  const color = value >= 70 ? 'bg-emerald-400' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

function StatBox({ value, label }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-4 text-center">
      <div className="text-xl font-bold text-cyan-400">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function StrokeTypeBadge({ type, confidence }) {
  const colors = {
    Freestyle: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    Backstroke: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    Breaststroke: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    Butterfly: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    'Detecting...': 'border-white/10 bg-white/[0.03] text-slate-400',
  }

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${colors[type] || colors['Detecting...']}`}>
      <span className="text-base font-bold">{type}</span>
      {type !== 'Detecting...' && (
        <span className="text-xs opacity-70">{confidence}% confidence</span>
      )}
    </div>
  )
}

export default function ScorePanel({ score, snapshot }) {
  if (!score) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
            <Activity className="h-6 w-6 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">Waiting for analysis…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 animate-slide-up">
      {snapshot && (
        <StrokeTypeBadge
          type={snapshot.strokeType}
          confidence={snapshot.strokeConfidence}
        />
      )}

      <ScoreRing score={score.total} />

      <div className="grid grid-cols-3 gap-3">
        <StatBox value={score.strokeCount} label="Strokes" />
        <StatBox value={score.strokeRate} label="SPM" />
        <StatBox value={`${score.consistency}%`} label="Timing" />
      </div>

      <div className="space-y-4">
        <MetricBar label="Symmetry" value={score.symmetry} />
        <MetricBar label="Extension" value={score.extension} />
        {snapshot && snapshot.bodyRotation != null && (
          <MetricBar label="Rotation" value={snapshot.bodyRotation} />
        )}
        {snapshot && snapshot.catchQuality != null && (
          <MetricBar label="Catch (EVF)" value={snapshot.catchQuality} />
        )}
      </div>

      {snapshot && (
        <div className="border-t border-white/[0.06] pt-5">
          <div className="grid grid-cols-2 gap-3">
            <StatBox value={`${snapshot.avgLeftExtension}%`} label="Left Arm" />
            <StatBox value={`${snapshot.avgRightExtension}%`} label="Right Arm" />
          </div>
        </div>
      )}
    </div>
  )
}
