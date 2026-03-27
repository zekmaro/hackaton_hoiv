// Daily study streak counter

interface Props {
  streak: number
}

export default function StreakCounter({ streak }: Props) {
  // TODO: add flame animation when streak > 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🔥</span>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-white">{streak}</p>
        <p className="text-xs text-slate-500">day streak</p>
      </div>
    </div>
  )
}
