export default function TipsPanel({ tips }) {
  if (!tips || tips.length === 0) return null

  const getTipStyle = (type) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-500/10'
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/10'
      case 'info':
      default:
        return 'border-cyan-500/30 bg-cyan-500/10'
    }
  }

  const getTipIcon = (type) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'info':
      default: return '💡'
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
        Coaching Tips
      </h3>
      {tips.map((tip, i) => (
        <div
          key={`${tip.type}-${i}`}
          className={`rounded-xl border p-3 text-sm text-slate-200 animate-slide-up ${getTipStyle(tip.type)}`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <span className="mr-2">{getTipIcon(tip.type)}</span>
          {tip.text}
        </div>
      ))}
    </div>
  )
}
