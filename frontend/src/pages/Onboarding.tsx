import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

type Message = { role: "assistant" | "user"; content: string }

type ExtractedData = {
  subjects: { name: string; level: string; currentStruggles: string }[]
  goals: string
  examDates: { subject: string; date: string }[]
  studyHoursPerDay: number
  learningStyle: "examples" | "theory" | "mixed"
}

export default function Onboarding() {
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const existingStudentId = localStorage.getItem("studentId")

  const [name, setName] = useState(() => localStorage.getItem("studentName") ?? "")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [turnCount, setTurnCount] = useState(0)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [syllabus, setSyllabus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNameStep, setShowNameStep] = useState(!existingStudentId)

  const progress = useMemo(() => {
    if (turnCount === 0) return 0
    if (extracted) return 100
    return Math.min(Math.round((turnCount / 7) * 95), 95)
  }, [turnCount, extracted])

  const resolveApiUrl = (path: string) => {
    return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
  }

  const bootstrapPrompt = async () => {
    if (!apiBase || loading || messages.length > 0 || extracted) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(resolveApiUrl("/onboard/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Student", messages: [] }),
      })
      if (!response.ok) throw new Error("Failed to reach onboarding service.")
      const data = await response.json()
      setMessages([{ role: "assistant", content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!showNameStep) {
      void bootstrapPrompt()
    }
  }, [showNameStep])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    if (!apiBase) {
      setError("Missing VITE_API_URL. Set it in .env before onboarding.")
      return
    }

    const updatedMessages: Message[] = [...messages, { role: "user", content: trimmed }]
    setMessages(updatedMessages)
    setInput("")
    setTurnCount((prev) => prev + 1)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(resolveApiUrl("/onboard/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Student", messages: updatedMessages }),
      })
      if (!response.ok) throw new Error("Failed to reach onboarding service.")
      const data = await response.json()
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
      if (data.done && data.extracted) {
        setExtracted(data.extracted as ExtractedData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!apiBase || !extracted) return
    setLoading(true)
    setError(null)

    try {
      if (!existingStudentId) {
        const response = await fetch(resolveApiUrl("/onboard/complete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || "Student",
            extracted,
            syllabus: syllabus.trim() || undefined,
          }),
        })
        if (!response.ok) throw new Error("Failed to complete onboarding.")
        const data = await response.json()
        localStorage.setItem("studentId", data.studentId)
        localStorage.setItem("studentName", name.trim() || "Student")
        if (data.studyPath) {
          localStorage.setItem("studyPath", JSON.stringify(data.studyPath))
        }
      } else {
        const response = await fetch(resolveApiUrl("/tutor/add"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: existingStudentId,
            extracted,
            syllabus: syllabus.trim() || undefined,
          }),
        })
        if (!response.ok) throw new Error("Failed to add subject.")
        const data = await response.json()
        if (data.studyPath) {
          const existing = JSON.parse(localStorage.getItem("studyPath") ?? "[]")
          localStorage.setItem("studyPath", JSON.stringify([...existing, ...data.studyPath]))
        }
      }
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#E6D7C5]">
        <div
          className="h-full bg-[#FF8C00] transition-[width] duration-700 ease-out shadow-[0_0_8px_rgba(255,140,0,0.45)]"
          style={{ width: `${progress}%` }}
        />
        {progress > 0 && (
          <span className="absolute right-4 top-2 text-[12px] font-medium text-[#FF8C00]">
            {progress}%
          </span>
        )}
      </div>

      <div className="mt-[3px] px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 font-sans text-lg">
          <span className="text-[#FF8C00] font-semibold">StudyUp</span>
          <span className="text-foreground/80">study</span>
        </div>
        <span className="text-xs text-muted-foreground">Setting up your tutor...</span>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-8 overflow-y-auto">
        {showNameStep ? (
          <div className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 shadow-sm">
            <h2 className="text-xl font-sans font-semibold mb-2">Let's start with your name</h2>
            <p className="text-sm text-muted-foreground mb-4">
              We'll use it to personalize your study plan.
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
            />
            <button
              onClick={() => setShowNameStep(false)}
              className="mt-4 rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "bg-[#FF8C00] text-white"
                      : "bg-[#FFF4CC] text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full border-t border-[#E6D7C5] bg-[#FFF4CC]/60 px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {extracted ? (
            <div className="w-full rounded-2xl border border-[#E6D7C5] bg-white/70 p-4">
              <p className="text-sm font-semibold mb-2">Optional syllabus</p>
              <textarea
                value={syllabus}
                onChange={(event) => setSyllabus(event.target.value)}
                placeholder="Paste your syllabus or leave blank..."
                className="w-full min-h-[120px] rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
              />
              <button
                onClick={handleComplete}
                className="mt-3 rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors"
                disabled={loading}
              >
                {loading ? "Saving..." : "Finish setup"}
              </button>
            </div>
          ) : (
            <>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend()
                }}
                placeholder="Type your answer..."
                className="flex-1 rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
              />
              <button
                onClick={handleSend}
                className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors"
                disabled={loading || showNameStep}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  )
}
