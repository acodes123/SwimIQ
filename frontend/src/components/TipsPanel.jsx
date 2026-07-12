import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react'

const TIP_STYLES = {
  success: {
    container: 'border-emerald-500/25 bg-emerald-500/[0.07]',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
  warning: {
    container: 'border-amber-500/25 bg-amber-500/[0.07]',
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  },
  info: {
    container: 'border-cyan-500/25 bg-cyan-500/[0.07]',
    icon: <Lightbulb className="h-4 w-4 text-cyan-400" />,
  },
}

export default function TipsPanel({ tips }) {
  if (!tips || tips.length === 0) return null

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Coaching Tips
      </h3>
      <div className="space-y-3">
        {tips.map((tip, i) => {
          const style = TIP_STYLES[tip.type] || TIP_STYLES.info
          return (
            <div
              key={`${tip.type}-${i}`}
              className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed text-slate-200 animate-slide-up ${style.container}`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="mt-0.5 shrink-0">{style.icon}</span>
              <span>{tip.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
