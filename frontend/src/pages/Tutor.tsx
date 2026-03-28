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
} from "@shared/types"

// ─── Speech recognition types ────────────────────────────────────────────────

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
type SpeechRecognitionInstance = {
  lang: string; interimResults: boolean; maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start: () => void; stop: () => void
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
  return {
    phase: match ? match[1] : null,
    clean: text.replace(/\[PHASE:[a-z_]+\]/g, "").trim(),
  }
}

function phaseFromMarker(marker: string | null): LessonPhase | null {
  if (marker === "example_done") return "practice"
  if (marker === "practice") return "practice"
  if (marker === "practice_passed") return "challenge"
  if (marker === "challenge_passed") return "complete"
  if (marker === "complete") return "complete"
  return null
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function TutorMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) =>
          className?.includes("language-") ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded text-[0.85em] font-mono">
              {children}
            </code>
          ),
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
        td: ({ children }) => <td className="border border-[#E6D7C5] px-3 py-2">{children}</td>,
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

  const decodedSubject = useMemo(() => decodeURIComponent(subject ?? ""), [subject])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const topic = searchParams.get("topic") ?? ""
  const nodeId = searchParams.get("nodeId") ?? ""
  const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"
  const isLesson = mode === "lesson"

  const realSubjectName = useMemo(() => {
    const sp = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    return sp.find((n) => n.subject.toLowerCase() === decodedSubject.toLowerCase())?.subject ?? decodedSubject
  }, [decodedSubject])

  // ── State ────────────────────────────────────────────────────────────────────

  // Committed messages (only complete, never partial)
  const [messages, setMessages] = useState<OnboardChatMessage[]>([])
  // In-progress streaming text — null when not streaming
  const [streamingContent, setStreamingContent] = useState<string | null>(null)

  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalXp, setTotalXp] = useState(0)
  const [lastXp, setLastXp] = useState<number | null>(null)
  const [currentPhase, setCurrentPhase] = useState<LessonPhase>("example")
  const [lessonComplete, setLessonComplete] = useState(false)
  const [listening, setListening] = useState(false)

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<OnboardChatMessage[]>([])
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  // Maps each phase to the message index where it starts (for scroll-to navigation)
  const phaseStartIndex = useRef<Partial<Record<LessonPhase, number>>>({})

  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Display messages: committed + in-progress streaming ───────────────────

  const displayMessages = useMemo(() => {
    if (streamingContent === null) return messages
    return [...messages, { role: "assistant" as const, content: streamingContent }]
  }, [messages, streamingContent])

  // ── Auto scroll ──────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [displayMessages])

  // ── API helper ───────────────────────────────────────────────────────────────

  const resolveApiUrl = useCallback(
    (path: string) => apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // ── Phase scroll navigation ──────────────────────────────────────────────────

  const scrollToPhase = useCallback((phase: LessonPhase) => {
    const idx = phaseStartIndex.current[phase]
    if (idx === undefined || !chatContainerRef.current) return
    const el = chatContainerRef.current.querySelector(`[data-msg-idx="${idx}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!studentId || !subject) { setError("Missing student profile."); return }
    if (!apiBase) { setError("Missing VITE_API_URL."); return }
    const trimmed = text.trim()
    if (!trimmed) return

    const currentMessages = messagesRef.current
    const userMsgIndex = currentMessages.length

    // Record phase 1 start at the first assistant message
    if (phaseStartIndex.current.example === undefined) {
      phaseStartIndex.current.example = userMsgIndex + 1
    }

    setMessages([...currentMessages, { role: "user", content: trimmed }])
    setInput("")
    setLoading(true)
    setError(null)
    setLastXp(null)

    // Declared outside try so catch can commit partial text on error
    let fullText = ""
    let finalPhase: string | null = null

    try {
      const payload: TutorMessageRequest = {
        studentId,
        subject: realSubjectName,
        message: trimmed,
        voiceMode: false,
        mode,
        topic: topic || undefined,
        nodeId: nodeId || undefined,
        sessionHistory: currentMessages.map((m) => ({ role: m.role, content: m.content })),
      }

      const response = await fetch(resolveApiUrl("/tutor/message/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error("Failed to reach the tutor service.")
      if (!response.body) throw new Error("No response stream.")

      // Start streaming — isolated state, never touches messages[]
      setStreamingContent("")
      setLoading(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data: ")) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === "chunk") {
            fullText += event.text as string
            setStreamingContent(parsePhaseMarker(fullText).clean)
          } else if (event.type === "done") {
            finalPhase = parsePhaseMarker(fullText).phase

            const activity = event.agentActivity as AgentActivity[] | undefined
            if (activity?.length) setAgentActivity((prev) => [...prev, ...activity])
            const xp = event.xpGained as number | undefined
            if (xp && xp > 0) { setTotalXp((p) => p + xp); setLastXp(xp) }
          }
        }
      }

      // Commit final message to messages[] and clear streaming state
      const { clean } = parsePhaseMarker(fullText)
      const committedIndex = messagesRef.current.length + 1 // after user msg
      setMessages((prev) => [...prev, { role: "assistant", content: clean }])
      setStreamingContent(null)

      // Update phase after committing
      const newPhase = phaseFromMarker(finalPhase)
      if (newPhase) {
        setCurrentPhase(newPhase)
        if (newPhase === "complete") {
          setLessonComplete(true)
          // Mark node complete in DB — unlocks next node and awards XP
          if (nodeId && studentId) {
            void fetch(resolveApiUrl("/lesson/complete"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nodeId, studentId, score: 8 }),
            })
          }
        }
        // Record where the next phase's messages start
        phaseStartIndex.current[newPhase] = committedIndex + 1
      }

    } catch (err) {
      // Commit whatever text arrived before the error — never discard it
      if (fullText.trim()) {
        const { clean } = parsePhaseMarker(fullText)
        setMessages((prev) => [...prev, { role: "assistant", content: clean }])
      }
      setStreamingContent(null)
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [apiBase, studentId, subject, resolveApiUrl, realSubjectName, mode, topic, nodeId])

  // ── Auto-send opening message ─────────────────────────────────────────────

  useEffect(() => {
    if (topic && !autoSentRef.current) {
      autoSentRef.current = true
      void sendMessage(isLesson ? `Start lesson on: ${topic}` : `Help me understand: ${topic}`)
    }
  }, [topic, isLesson, sendMessage])

  // ── Mic ───────────────────────────────────────────────────────────────────────

  const toggleListening = () => {
    const Ctor = (
      window.SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined
    if (!Ctor) { setError("Speech recognition not supported in this browser."); return }

    if (!recognitionRef.current) {
      const r = new Ctor()
      r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1
      r.onresult = (e) => {
        const t = e.results[0]?.[0]?.transcript ?? ""
        setInput((p) => p ? `${p} ${t}` : t)
      }
      r.onend = () => setListening(false)
      r.onerror = () => setListening(false)
      recognitionRef.current = r
    }

    if (listening) { recognitionRef.current.stop(); setListening(false) }
    else { setError(null); recognitionRef.current.start(); setListening(true) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const currentPhaseIndex = PHASES.indexOf(currentPhase)
  const isStreaming = streamingContent !== null

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
            <div>
              <p className="text-sm text-muted-foreground mb-1">{realSubjectName}</p>
              <h1 className="text-2xl md:text-3xl font-sans font-bold">
                {isLesson ? topic : "Free tutor"}
              </h1>
            </div>
            {totalXp > 0 && (
              <div className="rounded-full border border-[#E6D7C5] bg-white/80 px-4 py-1 text-sm">
                {totalXp} XP this session
              </div>
            )}
          </div>
        </div>

        {/* Phase progress bar — lesson mode only */}
        {isLesson && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            {PHASES.map((phase, i) => {
              const phaseIndex = PHASES.indexOf(phase)
              const isDone = phaseIndex < currentPhaseIndex
              const isActive = phase === currentPhase
              const isClickable = isDone && phaseStartIndex.current[phase] !== undefined
              return (
                <span key={phase} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => isClickable && scrollToPhase(phase)}
                    disabled={!isClickable}
                    title={isClickable ? `Jump to ${PHASE_LABELS[phase]}` : undefined}
                    className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
                      isDone
                        ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#15803D] cursor-pointer hover:bg-[#22C55E]/20"
                        : isActive
                        ? "bg-[#FF8C00] border-[#FF8C00] text-white cursor-default"
                        : "bg-white/60 border-[#E6D7C5] text-muted-foreground cursor-default opacity-50"
                    }`}
                  >
                    {isDone ? "✓ " : ""}{PHASE_LABELS[phase]}
                  </button>
                  {i < PHASES.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </span>
              )
            })}
          </div>
        )}

        {/* Main layout */}
        <div className="grid grid-cols-[1fr_300px] gap-6 max-[900px]:grid-cols-1">

          {/* Chat panel */}
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 flex flex-col gap-4 min-h-[480px]">

            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 space-y-5 overflow-y-auto max-h-[560px] pr-1"
            >
              {displayMessages.length === 0 && !loading && !isStreaming && (
                <div className="rounded-xl border border-[#E6D7C5] bg-white/80 p-4 text-sm text-muted-foreground">
                  {isLesson ? `Starting lesson on "${topic}"…` : "Ask your tutor anything to begin."}
                </div>
              )}

              {displayMessages.map((msg, index) => (
                <div
                  key={index}
                  data-msg-idx={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" ? (
                    <div className="w-full rounded-2xl border border-[#E6D7C5] bg-white/95 px-5 py-4 text-sm text-foreground shadow-sm">
                      <TutorMessage content={msg.content} />
                      {/* Cursor blink while this is the streaming message */}
                      {isStreaming && index === displayMessages.length - 1 && (
                        <span className="inline-block w-0.5 h-4 bg-[#FF8C00] animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[75%] rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm text-white shadow-sm leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {/* Only show Thinking... when waiting for first chunk, not during streaming */}
              {loading && !isStreaming && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[#E6D7C5] bg-white/90 px-4 py-3 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {lastXp !== null && lastXp > 0 && (
              <p className="text-sm font-semibold text-[#B45309]">+{lastXp} XP earned</p>
            )}

            {lessonComplete && (
              <div className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-5 flex flex-col gap-3">
                <p className="text-[#15803D] font-bold text-lg">Lesson complete! +{totalXp} XP earned</p>
                <p className="text-sm text-muted-foreground">You mastered: {topic}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
                  className="self-start rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-bold text-white hover:bg-green-600 transition-colors"
                >
                  Back to roadmap →
                </button>
              </div>
            )}

            {error && <p className="text-sm text-[#B91C1C]">{error}</p>}

            {!lessonComplete && (
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLesson ? "Show your working…" : "Type your question…"}
                  disabled={isStreaming}
                  className="flex-1 rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input) }
                  }}
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isStreaming}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    listening
                      ? "border-[#FF8C00] text-[#FF8C00] bg-[#FFEC99]"
                      : "border-[#E6D7C5] text-muted-foreground bg-white/80 hover:border-[#FF8C00] hover:text-[#FF8C00]"
                  }`}
                >
                  {listening ? "Listening…" : "Mic"}
                </button>
                <button
                  type="button"
                  onClick={() => void sendMessage(input)}
                  disabled={loading || isStreaming || !input.trim()}
                  className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            )}
          </section>

          {/* Agent activity sidebar */}
          <aside className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6">
            <h2 className="text-base font-sans font-bold mb-4">Agent activity</h2>
            {agentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Agent updates appear here once the tutor responds.</p>
            ) : (
              <ul className="space-y-3 max-h-[480px] overflow-y-auto">
                {agentActivity.map((a, i) => (
                  <li
                    key={`${a.agent}-${a.timestamp}-${i}`}
                    className="rounded-xl border border-[#E6D7C5] bg-white/80 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-[#8B5CF6]">[{a.agent}]</span> {a.action}
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
