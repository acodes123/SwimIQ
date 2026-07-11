import { getScoreColor, getScoreLabel } from '../utils/scoring'

function MetricBar({ label, value, color = 'from-cyan-500 to-blue-400' }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function StrokeTypeBadge({ type, confidence }) {
  const colors = {
    Freestyle: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    Backstroke: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    Breaststroke: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    Butterfly: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'Detecting...': 'bg-slate-500/20 border-slate-500/40 text-slate-400',
  }

  const icons = {
    Freestyle: '🏊',
    Backstroke: '🔄',
    Breaststroke: '🐸',
    Butterfly: '🦋',
    'Detecting...': '🔍',
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${colors[type] || colors['Detecting...']}`}>
      <div className="text-2xl mb-1">{icons[type] || '🔍'}</div>
      <div className="font-bold text-lg">{type}</div>
      {type !== 'Detecting...' && (
        <div className="text-xs opacity-70 mt-0.5">{confidence}% confidence</div>
      )}
    </div>
  )
}

export default function ScorePanel({ score, snapshot }) {
  if (!score) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">--</div>
          <div className="text-sm">Waiting for pose data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 space-y-5 animate-slide-up">
      {snapshot && (
        <StrokeTypeBadge
          type={snapshot.strokeType}
          confidence={snapshot.strokeConfidence}
        />
      )}

      <div className="text-center">
        <div className={`text-6xl font-black ${getScoreColor(score.total)} animate-score-in`}>
          {score.total}
        </div>
        <div className="text-sm text-slate-400 mt-1 font-medium">
          {getScoreLabel(score.total)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-cyan-400 font-bold text-lg">{score.strokeCount}</div>
          <div className="text-slate-500">Strokes</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-cyan-400 font-bold text-lg">{score.strokeRate}</div>
          <div className="text-slate-500">SPM</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-cyan-400 font-bold text-lg">{score.consistency}%</div>
          <div className="text-slate-500">Timing</div>
        </div>
      </div>

      <div className="space-y-3">
        <MetricBar
          label="Symmetry"
          value={score.symmetry}
          color={score.symmetry >= 70 ? 'from-emerald-500 to-emerald-400' : score.symmetry >= 50 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-red-400'}
        />
        <MetricBar
          label="Extension"
          value={score.extension}
          color={score.extension >= 70 ? 'from-emerald-500 to-emerald-400' : score.extension >= 50 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-red-400'}
        />
        {snapshot && snapshot.bodyRotation != null && (
          <MetricBar
            label="Rotation"
            value={snapshot.bodyRotation}
            color={snapshot.bodyRotation >= 70 ? 'from-emerald-500 to-emerald-400' : snapshot.bodyRotation >= 50 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-red-400'}
          />
        )}
        {snapshot && snapshot.catchQuality != null && (
          <MetricBar
            label="Catch (EVF)"
            value={snapshot.catchQuality}
            color={snapshot.catchQuality >= 70 ? 'from-emerald-500 to-emerald-400' : snapshot.catchQuality >= 50 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-red-400'}
          />
        )}
      </div>

      {snapshot && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-cyan-400 font-bold text-lg">
                {snapshot.avgLeftExtension}%
              </div>
              <div className="text-slate-500">Left Arm</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-cyan-400 font-bold text-lg">
                {snapshot.avgRightExtension}%
              </div>
              <div className="text-slate-500">Right Arm</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
