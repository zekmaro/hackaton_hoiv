import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'

export default function Navbar() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="font-bold text-lg text-slate-900 dark:text-white"
        >
          {/* TODO: replace with logo */}
          StudyAI
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={() => navigate('/onboarding')}
            className="bg-amber-400 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all"
          >
            Get started
          </button>
        </div>
      </div>
    </nav>
  )
}
