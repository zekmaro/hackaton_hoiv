import { useNavigate } from 'react-router-dom'
import type { TodaysFocus as TodaysFocusType } from '@shared/types'

interface Props {
  focus: TodaysFocusType
}

export default function TodaysFocus({ focus }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
        Today's Focus
      </p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">
        {focus.subject} — {focus.topic}
      </p>
      <p className="text-sm text-slate-500 mt-1">{focus.reason}</p>
      <button
        onClick={() => navigate(`/tutor/${focus.subject.toLowerCase()}`)}
        className="mt-4 bg-amber-400 hover:bg-amber-500 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all"
      >
        Start session
      </button>
    </div>
  )
}
