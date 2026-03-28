import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type {
  AgentActivity,
  OnboardChatMessage,
  RoadmapNode,
  TutorMessageRequest,
  TutorMessageResponse,
} from "@shared/types"

// ─── Speech recognition types ────────────────────────────────────────────────

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// ─── Phase types ─────────────────────────────────────────────────────────────

type LessonPhase = "example" | "practice" | "challenge" | "complete"

const PHASE_LABELS: Record<LessonPhase, string> = {
  example: "Worked Example",
  practice: "Practice",
  challenge: "Challenge",
  complete: "Complete",
}

const PHASES: LessonPhase[] = ["example", "practice", "challenge", "complete"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePhaseMarker(text: string): { clean: string; phase: string | null } {
  const match = text.match(/\[PHASE:([a-z_]+)\]/)
  const phase = match ? match[1] : null
  const clean = text.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
  return { clean, phase }
}

function phaseFromMarker(marker: string | null): LessonPhase | null {
  if (!marker) return null
  if (marker === "example_done") return "practice"
  if (marker === "practice") return "practice"
  if (marker === "practice_passed") return "challenge"
  if (marker === "challenge_passed") return "complete"
  if (marker === "complete") return "complete"
  return null
}

// ─── Markdown message renderer ────────────────────────────────────────────────

function TutorMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-")
          return isBlock ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded text-[0.85em] font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-[#F1F5F9] rounded-xl p-4 overflow-x-auto text-sm font-mono my-3 text-[#0F172A]">
            {children}
          </pre>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[#FF8C00]/40 pl-4 italic text-muted-foreground my-3">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#F1F5F9]">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-[#E6D7C5] px-3 py-2 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-[#E6D7C5] px-3 py-2">{children}</td>
        ),
        hr: () => <hr className="border-[#E6D7C5] my-4" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Tutor() {
  const { subject } = useParams<{ subject: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")

  // URL params
  const decodedSubject = useMemo(() => decodeURIComponent(subject ?? ""), [subject])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const topic = searchParams.get("topic") ?? ""
  const nodeId = searchParams.get("nodeId") ?? ""
  const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"
  const isLesson = mode === "lesson"

  // Real subject name (original casing from DB, not URL lowercase)
  const realSubjectName = useMemo(() => {
    const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    return (
      studyPath.find((n) => n.subject.toLowerCase() === decodedSubject.toLowerCase())?.subject
      ?? decodedSubject
    )
  }, [decodedSubject])

  // Chat state
  const [messages, setMessages] = useState<OnboardChatMessage[]>([])
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // XP state
  const [totalXp, setTotalXp] = useState(0)
  const [lastXp, setLastXp] = useState<number | null>(null)

  // Lesson phase state
  const [currentPhase, setCurrentPhase] = useState<LessonPhase>("example")
  const [lessonComplete, setLessonComplete] = useState(false)

  // Mic state
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // ── API URL helper ──────────────────────────────────────────────────────────

  const resolveApiUrl = useCallback(
    (path: string) =>
      apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // ── Auto scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!studentId || !subject) {
        setError("Missing student profile or subject. Return to onboarding first.")
        return
      }
      if (!apiBase) {
        setError("Missing VITE_API_URL. Configure the backend URL first.")
        return
      }

      const trimmed = text.trim()
      if (!trimmed) return

      const updatedMessages: OnboardChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ]

      setMessages(updatedMessages)
      setInput("")
      setLoading(true)
      setError(null)
      setLastXp(null)

      try {
        const payload: TutorMessageRequest = {
          studentId,
          subject: realSubjectName,
          message: trimmed,
          voiceMode: false,
          mode,
          topic: topic || undefined,
          nodeId: nodeId || undefined,
          sessionHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }

        const response = await fetch(resolveApiUrl("/tutor/message/stream"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) throw new Error("Failed to reach the tutor service.")
        if (!response.body) throw new Error("No response stream.")

        // Add empty assistant message placeholder
        setMessages((prev) => [...prev, { role: "assistant", content: "" }])

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let fullText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE lines end with \n\n — process complete events
          const parts = buffer.split("\n\n")
          buffer = parts.pop() ?? ""

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith("data: ")) continue
            const json = line.slice(6)
            let event: Record<string, unknown>
            try { event = JSON.parse(json) } catch { continue }

            if (event.type === "chunk") {
              fullText += event.text as string
              // Strip phase markers from display text as we build it
              const { clean } = parsePhaseMarker(fullText)
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: clean }
                return next
              })
            } else if (event.type === "clear") {
              fullText = ""
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: "" }
                return next
              })
            } else if (event.type === "done") {
              // Detect phase from completed text
              const { phase } = parsePhaseMarker(fullText)
              const newPhase = phaseFromMarker(phase)
              if (newPhase) {
                setCurrentPhase(newPhase)
                if (newPhase === "complete") setLessonComplete(true)
              }

              const activity = event.agentActivity as AgentActivity[] | undefined
              if (activity?.length) {
                setAgentActivity((prev) => [...prev, ...activity])
              }

              const xp = event.xpGained as number | undefined
              if (xp && xp > 0) {
                setTotalXp((prev) => prev + xp)
                setLastXp(xp)
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      } finally {
        setLoading(false)
      }
    },
    [apiBase, messages, studentId, subject, resolveApiUrl, realSubjectName, mode, topic, nodeId]
  )

  // ── Auto-send opening message ───────────────────────────────────────────────

  useEffect(() => {
    if (topic && messages.length === 0 && !autoSentRef.current) {
      autoSentRef.current = true
      // Lesson mode: "Start lesson on: X" triggers the structured lesson flow
      // Chat mode: "Help me understand: X" starts a free conversation
      const firstMessage = isLesson
        ? `Start lesson on: ${topic}`
        : `Help me understand: ${topic}`
      void sendMessage(firstMessage)
    }
  }, [topic, isLesson, messages.length, sendMessage])

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    void sendMessage(input)
  }

  // ── Mic ─────────────────────────────────────────────────────────────────────

  const toggleListening = () => {
    const SpeechRecognitionCtor = (
      window.SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser.")
      return
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = "en-US"
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ""
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
      recognition.onend = () => setListening(false)
      recognition.onerror = () => setListening(false)
      recognitionRef.current = recognition
    }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    } else {
      setError(null)
      recognitionRef.current?.start()
      setListening(true)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground font-sans">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to roadmap
          </button>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-sans font-bold">
              {isLesson ? `Lesson: ${topic}` : `Tutor: ${realSubjectName}`}
            </h1>
            {totalXp > 0 && (
              <div className="rounded-full border border-[#E6D7C5] bg-white/80 px-4 py-1 text-sm text-foreground">
                {totalXp} XP earned this session
              </div>
            )}
          </div>
          {topic && !isLesson && (
            <p className="mt-2 text-sm text-muted-foreground">Topic: {topic}</p>
          )}
        </div>

        {/* Phase indicator — only in lesson mode */}
        {isLesson && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            {PHASES.map((phase, i) => {
              const currentIndex = PHASES.indexOf(currentPhase)
              const phaseIndex = PHASES.indexOf(phase)
              const isDone = phaseIndex < currentIndex
              const isActive = phase === currentPhase
              return (
                <span key={phase} className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
                      isDone
                        ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#15803D]"
                        : isActive
                        ? "bg-[#FF8C00] border-[#FF8C00] text-white"
                        : "bg-white/60 border-[#E6D7C5] text-muted-foreground"
                    }`}
                  >
                    {PHASE_LABELS[phase]}
                  </span>
                  {i < PHASES.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </span>
              )
            })}
          </div>
        )}

        {/* Main layout */}
        <div className="grid grid-cols-[1fr_320px] gap-6 max-[900px]:grid-cols-1">

          {/* Chat panel */}
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 flex flex-col gap-4 min-h-[420px]">

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[520px] pr-1">
              {messages.length === 0 && !loading && (
                <div className="rounded-xl border border-[#E6D7C5] bg-white/80 p-4 text-sm text-muted-foreground">
                  {isLesson
                    ? `Starting your lesson on ${topic}...`
                    : topic
                    ? `Ready to explore ${topic}. Ask a question to begin.`
                    : "Ask your tutor anything to begin."}
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" ? (
                    <div className="w-full rounded-2xl border border-[#E6D7C5] bg-white/95 px-5 py-4 text-sm text-foreground shadow-sm">
                      <TutorMessage content={message.content} />
                    </div>
                  ) : (
                    <div className="max-w-[75%] rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm text-white shadow-sm leading-relaxed">
                      {message.content}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[#E6D7C5] bg-white/90 px-4 py-3 text-sm text-muted-foreground">
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* XP flash */}
            {lastXp !== null && lastXp > 0 && (
              <p className="text-sm font-semibold text-[#B45309]">+{lastXp} XP earned</p>
            )}

            {/* Lesson complete banner */}
            {lessonComplete && (
              <div className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-5 flex flex-col gap-3">
                <p className="text-[#15803D] font-bold text-lg">
                  Lesson complete! +{totalXp} XP earned
                </p>
                <p className="text-sm text-muted-foreground">
                  You mastered: {topic}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)
                  }
                  className="self-start rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-bold text-white hover:bg-green-600 transition-colors"
                >
                  Back to roadmap →
                </button>
              </div>
            )}

            {/* Error */}
            {error && <p className="text-sm text-[#B91C1C]">{error}</p>}

            {/* Input row */}
            {!lessonComplete && (
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLesson ? "Answer the problem..." : "Type your question..."}
                  className="flex-1 rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    listening
                      ? "border-[#FF8C00] text-[#FF8C00] bg-[#FFEC99]"
                      : "border-[#E6D7C5] text-muted-foreground bg-white/80 hover:border-[#FF8C00] hover:text-[#FF8C00]"
                  }`}
                >
                  {listening ? "Listening..." : "Mic"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            )}
          </section>

          {/* Agent activity sidebar */}
          <aside className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6">
            <h2 className="text-lg font-sans font-bold mb-4">Agent activity</h2>
            {agentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Agent updates will appear here once the tutor responds.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[480px] overflow-y-auto">
                {agentActivity.map((activity, index) => (
                  <li
                    key={`${activity.agent}-${activity.timestamp}-${index}`}
                    className="rounded-xl border border-[#E6D7C5] bg-white/80 px-3 py-2 text-sm text-foreground"
                  >
                    <span className="font-semibold">[{activity.agent}]</span>{" "}
                    {activity.action}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
