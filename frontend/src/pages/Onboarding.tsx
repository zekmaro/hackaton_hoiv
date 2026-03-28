import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = "university" | "high_school" | "self_learning"
type Goal = "pass_exam" | "deep_understanding" | "specific_grade" | "personal_interest"
type Hours = 1 | 2 | 3 | 4

type FormData = {
  name: string
  subject: string
  level: Level | null
  goal: Goal | null
  examDate: string | null   // ISO date or null
  struggles: string
  hours: Hours | null
  syllabus: string
}

type StepId =
  | "welcome"
  | "subject"
  | "level"
  | "goal"
  | "exam"
  | "struggles"
  | "hours"
  | "syllabus"
  | "generating"

const STEPS: StepId[] = [
  "welcome", "subject", "level", "goal", "exam", "struggles", "hours", "syllabus", "generating",
]

// ─── Speech helpers ───────────────────────────────────────────────────────────

type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start: () => void; stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-400"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            background: i <= current ? "#FF8C00" : "#E6D7C5",
          }}
        />
      ))}
    </div>
  )
}

// ─── Choice card ─────────────────────────────────────────────────────────────

function ChoiceCard({
  label,
  sub,
  icon,
  selected,
  onClick,
}: {
  label: string
  sub?: string
  icon: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border-2 px-5 py-4 flex items-center gap-4 transition-all duration-150 active:scale-[0.98]"
      style={{
        borderColor: selected ? "#FF8C00" : "#E6D7C5",
        background: selected ? "rgba(255,140,0,0.07)" : "rgba(255,244,204,0.5)",
        boxShadow: selected ? "0 0 0 3px rgba(255,140,0,0.15)" : "none",
      }}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-[15px] text-foreground">{label}</p>
        {sub && <p className="text-[13px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {selected && (
        <div
          className="ml-auto w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#FF8C00" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const existingStudentId = localStorage.getItem("studentId")

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [visible, setVisible] = useState(true)

  const [form, setForm] = useState<FormData>({
    name: localStorage.getItem("studentName") ?? "",
    subject: "",
    level: null,
    goal: null,
    examDate: null,
    struggles: "",
    hours: null,
    syllabus: "",
  })

  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState("Building your roadmap…")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const ttsAbortRef = useRef<AbortController | null>(null)
  const hasTTSRef = useRef(false)

  const step = STEPS[stepIndex]
  const visibleSteps = STEPS.filter((s) => s !== "generating") as Exclude<StepId, "generating">[]
  const dotIndex = visibleSteps.indexOf(step as Exclude<StepId, "generating">)

  const resolveUrl = useCallback(
    (path: string) =>
      apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const speak = useCallback(
    async (text: string) => {
      if (!apiBase) return
      ttsAbortRef.current?.abort()
      const abort = new AbortController()
      ttsAbortRef.current = abort
      try {
        const res = await fetch(resolveUrl("/tts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "tutor" }),
          signal: abort.signal,
        })
        if (!res.ok || abort.signal.aborted) return
        const blob = await res.blob()
        if (abort.signal.aborted) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true })
        await audio.play()
      } catch {
        // TTS is optional — silently ignore errors
      }
    },
    [apiBase, resolveUrl]
  )

  // ── Step question text for TTS ─────────────────────────────────────────────

  const questionForTTS = useCallback(
    (s: StepId): string | null => {
      const n = form.name || "there"
      switch (s) {
        case "welcome": return `Hi ${n}! I'm your AI study companion. Let's set up your personalized learning plan. What's your name?`
        case "subject": return `Great! What subject are you studying?`
        case "level": return `What level are you at?`
        case "goal": return `What's your main goal?`
        case "exam": return `Do you have an exam coming up?`
        case "struggles": return `What do you find hardest about this subject?`
        case "hours": return `How many hours a day can you realistically study?`
        case "syllabus": return `Optionally, paste your syllabus so I can tailor your roadmap even better.`
        default: return null
      }
    },
    [form.name]
  )

  // Auto-speak when step changes
  useEffect(() => {
    hasTTSRef.current = false
    if (step === "generating") return
    const q = questionForTTS(step)
    if (q && !hasTTSRef.current) {
      hasTTSRef.current = true
      void speak(q)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => { ttsAbortRef.current?.abort() }
  }, [])

  // ── STT ──────────────────────────────────────────────────────────────────────

  const startListening = useCallback((onResult: (text: string) => void) => {
    ttsAbortRef.current?.abort()
    const Ctor = (
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined
    if (!Ctor) return

    const r = new Ctor()
    r.lang = "en-US"
    r.interimResults = false
    r.continuous = false
    recognitionRef.current = r

    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? ""
      if (text.trim()) onResult(text.trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)

    try {
      r.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (target: number, dir: "forward" | "back" = "forward") => {
      setDirection(dir)
      setVisible(false)
      setTimeout(() => {
        setStepIndex(target)
        setVisible(true)
      }, 180)
    },
    []
  )

  const next = useCallback(() => goTo(stepIndex + 1, "forward"), [goTo, stepIndex])
  const back = useCallback(() => goTo(stepIndex - 1, "back"), [goTo, stepIndex])

  const update = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // ── Generate roadmap ──────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!apiBase) { setError("Missing VITE_API_URL"); return }
    goTo(STEPS.indexOf("generating"), "forward")
    setError(null)

    const extracted = {
      subjects: [
        {
          name: form.subject,
          level: form.level === "high_school" ? "high school" : form.level === "self_learning" ? "self-learning" : "university",
          currentStruggles: form.struggles || "general understanding",
        },
      ],
      goals:
        form.goal === "pass_exam" ? "Pass an exam"
        : form.goal === "deep_understanding" ? "Deep understanding of the subject"
        : form.goal === "specific_grade" ? "Achieve a specific grade"
        : "Personal interest and enrichment",
      examDates: form.examDate
        ? [{ subject: form.subject, date: form.examDate }]
        : [],
      studyHoursPerDay: form.hours ?? 2,
      learningStyle: "mixed" as const,
    }

    try {
      if (!existingStudentId) {
        setGenStatus("Creating your profile…")
        const res = await fetch(resolveUrl("/onboard/complete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim() || "Student",
            extracted,
            syllabus: form.syllabus.trim() || undefined,
          }),
        })
        if (!res.ok) throw new Error("Failed to complete onboarding.")
        const data = await res.json()
        localStorage.setItem("studentId", data.studentId)
        localStorage.setItem("studentName", form.name.trim() || "Student")
        if (data.studyPath) localStorage.setItem("studyPath", JSON.stringify(data.studyPath))
      } else {
        setGenStatus("Adding subject to your roadmap…")
        const res = await fetch(resolveUrl("/tutor/add"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: existingStudentId,
            extracted,
            syllabus: form.syllabus.trim() || undefined,
          }),
        })
        if (!res.ok) throw new Error("Failed to add subject.")
        const data = await res.json()
        if (data.studyPath) {
          const existing = JSON.parse(localStorage.getItem("studyPath") ?? "[]")
          localStorage.setItem("studyPath", JSON.stringify([...existing, ...data.studyPath]))
        }
      }
      setGenStatus("Done! Taking you to your dashboard…")
      setTimeout(() => navigate("/dashboard"), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      goTo(STEPS.indexOf("syllabus"), "back")
    }
  }, [apiBase, existingStudentId, form, goTo, navigate, resolveUrl])

  // ── Step can proceed check ────────────────────────────────────────────────────

  const canContinue = useCallback((): boolean => {
    switch (step) {
      case "welcome": return form.name.trim().length > 0
      case "subject": return form.subject.trim().length > 0
      case "level": return form.level !== null
      case "goal": return form.goal !== null
      case "exam": return true // optional
      case "struggles": return true // optional
      case "hours": return form.hours !== null
      case "syllabus": return true // optional
      default: return false
    }
  }, [step, form])

  // ── Slide animation styles ────────────────────────────────────────────────────

  const slideStyle: React.CSSProperties = {
    transition: "opacity 0.18s ease, transform 0.18s ease",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translateX(0)"
      : direction === "forward"
      ? "translateX(32px)"
      : "translateX(-32px)",
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#FFFBF2] text-foreground flex flex-col">

      {/* Top bar */}
      <div className="flex-shrink-0 px-6 py-5 flex items-center justify-between">
        <span className="text-[#FF8C00] font-bold text-lg">StudyUp</span>
        {stepIndex > 0 && step !== "generating" && (
          <button
            type="button"
            onClick={back}
            className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Progress dots */}
      {step !== "generating" && (
        <div className="flex-shrink-0 px-6 pb-6">
          <ProgressDots current={dotIndex} total={visibleSteps.length} />
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col px-6 max-w-lg mx-auto w-full" style={slideStyle}>

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 1</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">
                {existingStudentId ? "Add a new subject" : "Welcome 👋"}
              </h1>
              <p className="text-muted-foreground text-[15px]">
                {existingStudentId
                  ? "Let's add another subject to your roadmap."
                  : "I'm your AI study companion. Let's set up your personalized learning plan in under 2 minutes."}
              </p>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                What's your name?
              </label>
              <div className="relative">
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                  placeholder="Your first name"
                  className="w-full rounded-2xl border-2 border-[#E6D7C5] focus:border-[#FF8C00] bg-white px-5 py-4 text-[16px] text-foreground outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Subject ── */}
        {step === "subject" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 2</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">
                What are you studying?
              </h1>
              <p className="text-muted-foreground text-[15px]">Type the subject — be specific (e.g. "Calculus 2", "Organic Chemistry")</p>
            </div>
            <div className="relative">
              <input
                autoFocus
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                placeholder="e.g. Linear Algebra, Python, Physics"
                className="w-full rounded-2xl border-2 border-[#E6D7C5] focus:border-[#FF8C00] bg-white px-5 py-4 text-[16px] text-foreground outline-none transition-colors pr-14"
              />
              <button
                type="button"
                onClick={() => {
                  if (listening) { stopListening(); return }
                  startListening((text) => update("subject", text))
                }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  listening
                    ? "bg-[#FF8C00] text-white"
                    : "bg-[#F1F5F9] text-slate-500 hover:bg-[#E2E8F0]"
                }`}
                title="Speak your answer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Level ── */}
        {step === "level" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 3</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">What level are you at?</h1>
              <p className="text-muted-foreground text-[15px]">This helps calibrate the depth of your lessons.</p>
            </div>
            <div className="flex flex-col gap-3">
              <ChoiceCard icon="🎓" label="University" sub="Bachelor's, Master's or equivalent" selected={form.level === "university"} onClick={() => { update("level", "university"); setTimeout(next, 260) }} />
              <ChoiceCard icon="📚" label="High School" sub="Secondary education" selected={form.level === "high_school"} onClick={() => { update("level", "high_school"); setTimeout(next, 260) }} />
              <ChoiceCard icon="🌱" label="Self-learning" sub="On my own schedule" selected={form.level === "self_learning"} onClick={() => { update("level", "self_learning"); setTimeout(next, 260) }} />
            </div>
          </div>
        )}

        {/* ── Goal ── */}
        {step === "goal" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 4</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">What's your main goal?</h1>
              <p className="text-muted-foreground text-[15px]">We'll focus your lessons around this.</p>
            </div>
            <div className="flex flex-col gap-3">
              <ChoiceCard icon="📝" label="Pass an exam" sub="I have a specific test coming up" selected={form.goal === "pass_exam"} onClick={() => { update("goal", "pass_exam"); setTimeout(next, 260) }} />
              <ChoiceCard icon="🧠" label="Deep understanding" sub="I want to really get it, not just memorise" selected={form.goal === "deep_understanding"} onClick={() => { update("goal", "deep_understanding"); setTimeout(next, 260) }} />
              <ChoiceCard icon="⭐" label="Hit a specific grade" sub="I need a certain mark" selected={form.goal === "specific_grade"} onClick={() => { update("goal", "specific_grade"); setTimeout(next, 260) }} />
              <ChoiceCard icon="💡" label="Personal interest" sub="I'm curious and want to learn" selected={form.goal === "personal_interest"} onClick={() => { update("goal", "personal_interest"); setTimeout(next, 260) }} />
            </div>
          </div>
        )}

        {/* ── Exam date ── */}
        {step === "exam" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 5</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">Exam date?</h1>
              <p className="text-muted-foreground text-[15px]">Optional — if you have one, we'll pace your roadmap around it.</p>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="date"
                value={form.examDate ?? ""}
                onChange={(e) => update("examDate", e.target.value || null)}
                className="w-full rounded-2xl border-2 border-[#E6D7C5] focus:border-[#FF8C00] bg-white px-5 py-4 text-[16px] text-foreground outline-none transition-colors"
                min={new Date().toISOString().slice(0, 10)}
              />
              <button
                type="button"
                onClick={() => { update("examDate", null); next() }}
                className="w-full rounded-2xl border-2 border-dashed border-[#E6D7C5] px-5 py-4 text-[15px] text-muted-foreground hover:border-[#FF8C00] hover:text-[#FF8C00] transition-colors text-center font-medium"
              >
                No exam — ongoing learning
              </button>
            </div>
          </div>
        )}

        {/* ── Struggles ── */}
        {step === "struggles" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 6</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">What feels hardest?</h1>
              <p className="text-muted-foreground text-[15px]">Optional but useful — we'll prioritise these in your plan.</p>
            </div>
            <div className="relative">
              <textarea
                autoFocus
                value={form.struggles}
                onChange={(e) => update("struggles", e.target.value)}
                placeholder="e.g. Proofs, integration by parts, word problems…"
                rows={4}
                className="w-full rounded-2xl border-2 border-[#E6D7C5] focus:border-[#FF8C00] bg-white px-5 py-4 text-[15px] text-foreground outline-none transition-colors resize-none pr-14"
              />
              <button
                type="button"
                onClick={() => {
                  if (listening) { stopListening(); return }
                  startListening((text) => update("struggles", text))
                }}
                className={`absolute right-3 top-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  listening
                    ? "bg-[#FF8C00] text-white"
                    : "bg-[#F1F5F9] text-slate-500 hover:bg-[#E2E8F0]"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Study hours ── */}
        {step === "hours" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 7</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">Hours per day?</h1>
              <p className="text-muted-foreground text-[15px]">We'll pace your roadmap to match your schedule.</p>
            </div>
            <div className="flex flex-col gap-3">
              {([1, 2, 3, 4] as Hours[]).map((h) => (
                <ChoiceCard
                  key={h}
                  icon={h === 1 ? "🌱" : h === 2 ? "📖" : h === 3 ? "🔥" : "⚡"}
                  label={h === 4 ? "4+ hours" : `${h} hour${h > 1 ? "s" : ""}`}
                  sub={h === 1 ? "Light — consistent beats intense" : h === 2 ? "Solid daily habit" : h === 3 ? "Strong commitment" : "Deep immersion"}
                  selected={form.hours === h}
                  onClick={() => { update("hours", h); setTimeout(next, 260) }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Syllabus ── */}
        {step === "syllabus" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[13px] text-[#FF8C00] font-semibold uppercase tracking-widest mb-2">Step 8</p>
              <h1 className="text-[28px] font-bold leading-tight mb-2">Got a syllabus?</h1>
              <p className="text-muted-foreground text-[15px]">Optional — paste your course outline and we'll build your roadmap around it exactly.</p>
            </div>
            <textarea
              value={form.syllabus}
              onChange={(e) => update("syllabus", e.target.value)}
              placeholder="Paste your syllabus, topic list, or leave blank…"
              rows={6}
              className="w-full rounded-2xl border-2 border-[#E6D7C5] focus:border-[#FF8C00] bg-white px-5 py-4 text-[14px] text-foreground outline-none transition-colors resize-none"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}

        {/* ── Generating ── */}
        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 pb-16">
            <div className="relative w-24 h-24">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #fbbf24, #92400e)",
                  boxShadow: "0 0 50px 12px rgba(251,191,36,0.3)",
                  animation: "orb-think 2s ease-in-out infinite",
                }}
              />
            </div>
            <div>
              <h2 className="text-[22px] font-bold mb-2">Building your roadmap</h2>
              <p className="text-muted-foreground text-[15px]">{genStatus}</p>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#FF8C00]"
                  style={{ animation: `mic-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Continue button (non-auto-advance steps) ── */}
        {step !== "generating" && step !== "level" && step !== "goal" && step !== "hours" && (
          <div className="mt-auto pt-8 pb-8">
            <button
              type="button"
              onClick={step === "syllabus" ? generate : next}
              disabled={!canContinue()}
              className="w-full rounded-2xl py-4 text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: "#FF8C00", boxShadow: "0 4px 20px rgba(255,140,0,0.3)" }}
            >
              {step === "syllabus" ? "Build my roadmap →" : step === "welcome" ? "Let's go →" : "Continue →"}
            </button>
            {(step === "exam" || step === "struggles") && (
              <button
                type="button"
                onClick={next}
                className="w-full mt-3 py-3 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
