import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiClient } from '../lib/api'
import { useStudentId } from '../hooks/useStudentId'

// Multi-step onboarding form
// Step 1: Name + goals
// Step 2: Add subjects (chips)
// Step 3: Exam dates per subject
// Step 4: Study hours/day slider
// On submit → POST /api/onboard → save studentId → redirect to /dashboard

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setStudentId } = useStudentId()

  // TODO: form state (name, goals, subjects, examDates, studyHoursPerDay)
  // TODO: step components with Framer Motion slide transitions
  // TODO: progress bar at top

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // TODO: collect form data and call ApiClient.onboard(formData)
      // const res = await ApiClient.onboard(formData)
      // setStudentId(res.studentId)
      // navigate('/dashboard')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-8 w-full max-w-lg shadow-sm">
        {/* TODO: StepIndicator component */}
        <p className="text-slate-500 text-sm mb-6">Step {step} of 4</p>

        {/* TODO: render step components */}
        <p className="text-slate-400">Onboarding step {step} — TODO</p>

        <div className="flex justify-between mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-xl transition-all"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="ml-auto bg-amber-400 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="ml-auto bg-amber-400 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? 'Building your roadmap...' : 'Start learning'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
