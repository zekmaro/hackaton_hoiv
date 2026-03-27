import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiClient } from '../lib/api'
import { useStudentId } from '../hooks/useStudentId'
import type { StudyPathResponse } from '@shared/types'

// Dashboard layout: sidebar (subjects, XP, streak) + main (study path roadmap)
// Roadmap: horizontal scrollable animated nodes — see docs/design-system.md
// Node colors by status and priority — see docs/design-system.md

export default function Dashboard() {
  const [data, setData] = useState<StudyPathResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { getStudentId } = useStudentId()
  const navigate = useNavigate()

  useEffect(() => {
    const studentId = getStudentId()
    if (!studentId) { navigate('/onboarding'); return }

    ApiClient.getStudyPath(studentId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 p-6 flex flex-col gap-6">
        {/* TODO: student name */}
        {/* TODO: XPBar component */}
        {/* TODO: StreakCounter component */}
        {/* TODO: subjects list — each item navigates to /tutor/:subject */}
        <p className="text-slate-400 text-sm">Sidebar — TODO</p>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {/* TODO: TodaysFocus component */}
        {/* TODO: StudyPath component — animated roadmap nodes */}
        {/* TODO: Next exam countdown */}
        <p className="text-slate-400">Dashboard main — TODO</p>
        {data && (
          <pre className="text-xs text-slate-400 mt-4 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </main>
    </div>
  )
}
