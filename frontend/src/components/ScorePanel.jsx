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


