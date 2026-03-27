// XP progress bar with animated count-up
// Level = Math.floor(xp / 500), progress = xp % 500

interface Props {
  xp: number
  level: number
}

export default function XPBar({ xp, level }: Props) {
  const progress = xp % 500
  const percent = (progress / 500) * 100

  // TODO: animate number count-up with Framer Motion when xp changes
  // TODO: level-up celebration animation when level increases

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Level {level}</span>
        <span>{xp} XP</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
