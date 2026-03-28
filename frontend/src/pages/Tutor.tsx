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
import VoiceMode from "../components/VoiceMode"

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
const PHASES: LessonPhase[] = ["example", "practice", "challenge", "complete"]
const PHASE_LABELS: Record<LessonPhase, string> = {
  example: "Lecture",
  practice: "Practice",
  challenge: "Challenge",
  complete: "Complete",
}

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

function LessonDoc({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="lesson-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-4 leading-[1.8] text-[#2d2d2d]">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[#1a1a1a]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded text-[0.88em] font-mono">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 overflow-x-auto text-sm font-mono my-5 text-[#0F172A]">
              {children}
            </pre>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5 text-[#2d2d2d]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-[#2d2d2d]">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-6 text-[#1a1a1a]">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-5 text-[#1a1a1a] uppercase tracking-wide text-xs opacity-60">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-4 text-[#1a1a1a]">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#FF8C00]/50 pl-4 text-[#555] my-4 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-5">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#F8FAFC]">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-[#E2E8F0] px-4 py-2 text-left font-semibold text-xs uppercase tracking-wide">{children}</th>
          ),
          td: ({ children }) => <td className="border border-[#E2E8F0] px-4 py-2">{children}</td>,
          hr: () => <hr className="border-[#E2E8F0] my-6" />,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-5 bg-[#FF8C00] animate-pulse align-middle" />
      )}
    </div>
  )
}

// ─── Phase stepper ────────────────────────────────────────────────────────────

function PhaseStepper({ current }: { current: LessonPhase }) {
  const idx = PHASES.indexOf(current)
  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={phase} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              done ? "bg-[#22C55E]/15 text-[#16a34a]"
              : active ? "bg-[#FF8C00] text-white"
              : "text-[#94a3b8]"
            }`}>
              {done && <span>✓</span>}
              {PHASE_LABELS[phase]}
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-6 h-px ${i < idx ? "bg-[#22C55E]/40" : "bg-[#E2E8F0]"}`} />
            )}
          </div>
        )
      })}
    </div>
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
  const lessonMode = (searchParams.get("lessonMode") ?? "lecture") as "lecture" | "practice"
  const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"
  const isLesson = mode === "lesson"

  const realSubjectName = useMemo(() => {
    const sp = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    return sp.find((n) => n.subject.toLowerCase() === decodedSubject.toLowerCase())?.subject ?? decodedSubject
  }, [decodedSubject])

  // ── State ────────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<OnboardChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalXp, setTotalXp] = useState(0)
  const [currentPhase, setCurrentPhase] = useState<LessonPhase>(
    isLesson && lessonMode === "practice" ? "practice" : "example"
  )
  const [lessonComplete, setLessonComplete] = useState(false)
  const [voiceModeActive, setVoiceModeActive] = useState(false)
  const [listening, setListening] = useState(false)

  // Lesson-specific: track content per phase
  const [lectureContent, setLectureContent] = useState<string | null>(null)
  const [lectureReady, setLectureReady] = useState(false) // lecture received, show "practice" CTA
  const [practiceContent, setPracticeContent] = useState<string | null>(null)
  const [feedbackContent, setFeedbackContent] = useState<string | null>(null)
  const [challengeContent, setChallengeContent] = useState<string | null>(null)

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<OnboardChatMessage[]>([])
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const phaseStartIndex = useRef<Partial<Record<LessonPhase, number>>>({})

  useEffect(() => { messagesRef.current = messages }, [messages])

  const displayMessages = useMemo(() => {
    if (streamingContent === null) return messages
    return [...messages, { role: "assistant" as const, content: streamingContent }]
  }, [messages, streamingContent])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [displayMessages])

  const resolveApiUrl = useCallback(
    (path: string) => apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  const stopStreaming = useCallback(() => { abortControllerRef.current?.abort() }, [])

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!studentId || !subject) { setError("Missing student profile."); return }
    if (!apiBase) { setError("Missing VITE_API_URL."); return }
    const trimmed = text.trim()
    if (!trimmed) return

    const currentMessages = messagesRef.current
    const userMsgIndex = currentMessages.length
    if (phaseStartIndex.current.example === undefined) {
      phaseStartIndex.current.example = userMsgIndex + 1
    }

    setMessages([...currentMessages, { role: "user", content: trimmed }])
    setInput("")
    setLoading(true)
    setError(null)

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

      const abort = new AbortController()
      abortControllerRef.current = abort

      const response = await fetch(resolveApiUrl("/tutor/message/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abort.signal,
      })

      if (!response.ok) throw new Error("Failed to reach the tutor service.")
      if (!response.body) throw new Error("No response stream.")

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
            if (xp && xp > 0) setTotalXp((p) => p + xp)
          }
        }
      }

      const { clean } = parsePhaseMarker(fullText)
      const committedIndex = messagesRef.current.length + 1
      setMessages((prev) => [...prev, { role: "assistant", content: clean }])
      setStreamingContent(null)

      // Update lesson state based on phase marker
      if (finalPhase === "example_done") {
        setLectureContent(clean)
        setLectureReady(true)
        setCurrentPhase("practice")
      } else if (finalPhase === "practice") {
        setPracticeContent(clean)
        setFeedbackContent(null)
        setCurrentPhase("practice")
        phaseStartIndex.current.practice = committedIndex + 1
      } else if (finalPhase === "practice_passed") {
        setFeedbackContent(clean)
        setChallengeContent(null)
        setCurrentPhase("challenge")
        phaseStartIndex.current.challenge = committedIndex + 1
      } else if (finalPhase === "challenge_passed") {
        setFeedbackContent(clean)
        setCurrentPhase("complete")
      } else if (finalPhase === "complete") {
        setLessonComplete(true)
        setCurrentPhase("complete")
        if (nodeId && studentId) {
          void fetch(resolveApiUrl("/lesson/complete"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId, studentId, score: 8 }),
          })
        }
      } else {
        // Feedback without phase transition (wrong answer, hint, etc.)
        setFeedbackContent(clean)
      }

    } catch (err) {
      if (fullText.trim()) {
        const { clean } = parsePhaseMarker(fullText)
        setMessages((prev) => [...prev, { role: "assistant", content: clean }])
        setFeedbackContent(clean)
      }
      setStreamingContent(null)
      const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"))
      if (!isAbort) setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [apiBase, studentId, subject, resolveApiUrl, realSubjectName, mode, topic, nodeId])

  // ── Auto-send opening message ─────────────────────────────────────────────

  useEffect(() => {
    if (topic && !autoSentRef.current) {
      autoSentRef.current = true
      const lessonKickoff =
        lessonMode === "practice"
          ? `Start practice on: ${topic}`
          : `Start lecture on: ${topic}`
      void sendMessage(isLesson ? lessonKickoff : `Help me understand: ${topic}`)
    }
  }, [topic, isLesson, sendMessage, lessonMode])

  // ── Mic ───────────────────────────────────────────────────────────────────────

  const toggleListening = () => {
    const Ctor = (
      window.SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined
    if (!Ctor) { setError("Speech recognition not supported."); return }
    if (!recognitionRef.current) {
      const r = new Ctor()
      r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1
      r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ""; setInput((p) => p ? `${p} ${t}` : t) }
      r.onend = () => setListening(false)
      r.onerror = () => setListening(false)
      recognitionRef.current = r
    }
    if (listening) { recognitionRef.current.stop(); setListening(false) }
    else { setError(null); recognitionRef.current.start(); setListening(true) }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const isStreaming = streamingContent !== null
  const currentPhaseIndex = PHASES.indexOf(currentPhase)

  // ── LESSON MODE ───────────────────────────────────────────────────────────────

  if (isLesson) {
    // Lecture content always stays visible once received — phase change never hides it
    const mainContent = isStreaming && !lectureContent
      ? streamingContent!
      : lectureContent ?? (isStreaming ? streamingContent! : null)

    // The problem for practice/challenge
    const activeProblem = currentPhase === "challenge"
      ? (challengeContent ?? practiceContent)
      : practiceContent

    // Whether we're waiting for the first response
    const awaitingLecture = loading && !lectureContent && !isStreaming

    return (
      <>
        {voiceModeActive && (
          <VoiceMode
            onClose={() => setVoiceModeActive(false)}
            subject={decodedSubject}
            realSubjectName={realSubjectName}
            topic={topic}
            mode={mode}
            nodeId={nodeId}
            studentId={studentId ?? ""}
            apiBase={apiBase}
            initialMessages={messages}
          />
        )}

        <div className="min-h-screen bg-[#FAFAF8] font-sans">

          {/* Sticky top bar */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E2E8F0] px-6 py-3">
            <div className="mx-auto max-w-4xl flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
                className="text-sm text-[#64748b] hover:text-[#1a1a1a] transition-colors flex items-center gap-1.5"
              >
                ← {realSubjectName}
              </button>

              <PhaseStepper current={currentPhase} />

              <div className="flex items-center gap-3">
                {totalXp > 0 && (
                  <span className="text-xs font-bold text-[#B45309] bg-[#FEF3C7] px-2.5 py-1 rounded-full">
                    +{totalXp} XP
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setVoiceModeActive(true)}
                  className="flex items-center gap-1.5 rounded-full bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                  </svg>
                  Voice
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="mx-auto max-w-3xl px-6 pt-10 pb-40">

            {/* Topic heading */}
            <div className="mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
                {PHASE_LABELS[currentPhase]}
              </p>
              <h1 className="text-3xl font-bold text-[#1a1a1a] leading-tight">{topic}</h1>
            </div>

            {/* Loading skeleton */}
            {awaitingLecture && (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-[#E2E8F0] rounded w-3/4" />
                <div className="h-4 bg-[#E2E8F0] rounded w-full" />
                <div className="h-4 bg-[#E2E8F0] rounded w-5/6" />
                <div className="h-4 bg-[#E2E8F0] rounded w-2/3" />
                <div className="h-32 bg-[#E2E8F0] rounded-xl w-full mt-6" />
                <div className="h-4 bg-[#E2E8F0] rounded w-full" />
                <div className="h-4 bg-[#E2E8F0] rounded w-4/5" />
              </div>
            )}

            {/* Lecture content (phase 1 + streaming) */}
            {(mainContent !== null || isStreaming) && currentPhase !== "complete" && (
              <div ref={chatContainerRef}>
                <LessonDoc
                  content={isStreaming ? streamingContent! : (mainContent ?? "")}
                  isStreaming={isStreaming}
                />
              </div>
            )}

            {/* Practice / Challenge area */}
            {(currentPhase === "practice" || currentPhase === "challenge") && !isStreaming && (
              <div className="mt-10 space-y-6">
                {/* Problem card */}
                {(isStreaming ? null : (currentPhase === "challenge" ? challengeContent : practiceContent) ?? (isStreaming ? streamingContent : null)) === null && loading ? null : (
                  activeProblem || isStreaming ? (
                    <div className="rounded-2xl bg-[#0F172A] px-7 py-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4">
                        {currentPhase === "challenge" ? "Challenge Problem" : "Practice Problem"}
                      </p>
                      <div className="text-white">
                        <LessonDoc content={activeProblem ?? ""} />
                      </div>
                    </div>
                  ) : null
                )}

                {/* Feedback card */}
                {feedbackContent && (
                  <div className="rounded-2xl border-l-4 border-[#FF8C00] bg-[#FFF7ED] px-6 py-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF8C00] mb-3">Feedback</p>
                    <LessonDoc content={feedbackContent} />
                  </div>
                )}
              </div>
            )}

            {/* Completion screen */}
            {currentPhase === "complete" && lessonComplete && (
              <div className="mt-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#22C55E]/15 text-4xl">
                  🎓
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Lesson complete</h2>
                  <p className="text-[#64748b]">You've mastered <strong>{topic}</strong></p>
                  {totalXp > 0 && (
                    <p className="text-[#B45309] font-bold mt-1">+{totalXp} XP earned</p>
                  )}
                </div>
                {feedbackContent && (
                  <div className="text-left bg-white border border-[#E2E8F0] rounded-2xl px-6 py-5 max-w-xl mx-auto">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Summary</p>
                    <LessonDoc content={feedbackContent} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#22C55E] px-7 py-3 font-bold text-white hover:bg-green-600 transition-colors text-sm"
                >
                  Back to roadmap →
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm text-[#B91C1C] bg-red-50 px-4 py-3 rounded-xl">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Fixed bottom input bar */}
          {!lessonComplete && (
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#E2E8F0] px-6 py-4">
              <div className="mx-auto max-w-3xl">

                {/* Phase 1 complete — offer to move to practice */}
                {currentPhase === "practice" && lectureReady && !practiceContent && !loading && (
                  <div className="flex items-center gap-3">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question about the lecture…"
                      className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/30"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input) } }}
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage(input.trim() || "I understand the lecture. Give me a practice problem.")}
                      className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-bold text-white hover:bg-[#e07b00] transition-colors whitespace-nowrap"
                    >
                      {input.trim() ? "Ask" : "Practice problems →"}
                    </button>
                  </div>
                )}

                {/* Practice / Challenge — answer submission */}
                {(currentPhase === "practice" || currentPhase === "challenge") && (practiceContent || challengeContent || feedbackContent) && (
                  <div className="space-y-2">
                    {feedbackContent && (
                      <p className="text-xs text-[#94a3b8] font-medium px-1">
                        {currentPhase === "practice" ? "Refine your answer or ask for a hint" : "Attempt the challenge"}
                      </p>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={currentPhase === "challenge" ? "Write your solution to the challenge…" : "Write your solution…"}
                        rows={3}
                        disabled={isStreaming}
                        className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/30 resize-none disabled:opacity-50"
                        onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); void sendMessage(input) } }}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void sendMessage("Give me a hint")}
                          disabled={isStreaming || loading}
                          className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#64748b] hover:border-[#FF8C00] hover:text-[#FF8C00] transition-colors disabled:opacity-50"
                        >
                          Hint
                        </button>
                        {isStreaming ? (
                          <button
                            type="button"
                            onClick={stopStreaming}
                            className="w-10 h-10 rounded-full bg-[#0F172A] hover:bg-[#1e293b] flex items-center justify-center transition-colors"
                          >
                            <span className="w-3 h-3 rounded-sm bg-white block" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void sendMessage(input)}
                            disabled={loading || !input.trim()}
                            className="rounded-xl bg-[#FF8C00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e07b00] transition-colors disabled:opacity-50"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] px-1">Ctrl+Enter to submit</p>
                  </div>
                )}

                {/* Loading while streaming */}
                {(loading && !isStreaming) && (
                  <div className="flex items-center gap-2 text-sm text-[#94a3b8] py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    Thinking…
                  </div>
                )}

                {/* Streaming — show stop button */}
                {isStreaming && currentPhase === "example" && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#94a3b8] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF8C00] animate-pulse" />
                      Writing lecture…
                    </span>
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="w-9 h-9 rounded-full bg-[#0F172A] hover:bg-[#1e293b] flex items-center justify-center transition-colors ml-auto"
                    >
                      <span className="w-3 h-3 rounded-sm bg-white block" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // ── FREE CHAT MODE ────────────────────────────────────────────────────────────

  return (
    <>
      {voiceModeActive && (
        <VoiceMode
          onClose={() => setVoiceModeActive(false)}
          subject={decodedSubject}
          realSubjectName={realSubjectName}
          topic={topic}
          mode={mode}
          nodeId={nodeId}
          studentId={studentId ?? ""}
          apiBase={apiBase}
          initialMessages={messages}
        />
      )}
      <main className="min-h-screen bg-background px-6 py-16 text-foreground font-sans">
        <div className="mx-auto max-w-4xl">

          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
              className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{realSubjectName}</p>
                <h1 className="text-2xl font-bold">{topic || "Free tutor"}</h1>
              </div>
              <div className="flex items-center gap-3">
                {totalXp > 0 && (
                  <span className="text-xs font-bold text-[#B45309] bg-[#FEF3C7] px-3 py-1 rounded-full">
                    +{totalXp} XP
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setVoiceModeActive(true)}
                  className="flex items-center gap-2 rounded-full bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e293b] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                  </svg>
                  Voice mode
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/60 p-6 flex flex-col gap-4 min-h-[500px]">
            <div
              ref={chatContainerRef}
              className="flex-1 space-y-5 overflow-y-auto max-h-[600px] pr-1"
            >
              {displayMessages.length === 0 && !loading && !isStreaming && (
                <p className="text-sm text-muted-foreground p-2">Ask anything — this is office hours.</p>
              )}
              {displayMessages.map((msg, index) => (
                <div
                  key={index}
                  data-msg-idx={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" ? (
                    <div className="w-full bg-white rounded-2xl border border-[#E6D7C5] px-5 py-4 text-sm shadow-sm">
                      <LessonDoc content={msg.content} isStreaming={isStreaming && index === displayMessages.length - 1} />
                    </div>
                  ) : (
                    <div className="max-w-[70%] rounded-2xl bg-[#0F172A] px-4 py-3 text-sm text-white leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {loading && !isStreaming && (
                <div className="flex gap-1 px-2 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && <p className="text-sm text-[#B91C1C]">{error}</p>}

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your tutor anything…"
                disabled={isStreaming}
                className="flex-1 rounded-xl border border-[#E6D7C5] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/30 disabled:opacity-50"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input) } }}
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={isStreaming}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  listening ? "border-[#FF8C00] text-[#FF8C00] bg-[#FEF3C7]" : "border-[#E6D7C5] text-muted-foreground bg-white hover:border-[#FF8C00]"
                }`}
              >
                {listening ? "●" : "Mic"}
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="w-11 h-11 rounded-full bg-[#0F172A] hover:bg-[#1e293b] flex items-center justify-center transition-colors"
                >
                  <span className="w-3.5 h-3.5 rounded-sm bg-white block" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e07b00] transition-colors disabled:opacity-60"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
