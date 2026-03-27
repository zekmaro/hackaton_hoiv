import { useNavigate } from 'react-router-dom'

// Landing page — sections: Hero → Problem → How It Works → CTA
// Design reference: docs/design-system.md
// Style: Stripe + Duolingo + Linear feel

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* TODO: Navbar — logo left, dark mode toggle + CTA right */}

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          Your personal AI teacher.<br />
          <span className="text-amber-400">For every subject.</span>
        </h1>
        <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Get a personalized study roadmap, talk to your AI tutor by voice,
          and receive smart reminders — all tailored to your exams and goals.
        </p>
        <button
          onClick={() => navigate('/onboarding')}
          className="mt-8 bg-amber-400 hover:bg-amber-500 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all"
        >
          Start learning for free
        </button>
      </section>

      {/* TODO: Problem section */}
      {/* TODO: How it works section */}
      {/* TODO: Demo / product preview section */}
      {/* TODO: Gamification section */}
      {/* TODO: CTA section */}
    </div>
  )
}
