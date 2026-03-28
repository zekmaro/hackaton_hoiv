import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { OnboardChatMessage, TutorMessageRequest } from "@shared/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type LessonPhase = "example" | "practice" | "challenge" | "complete"
type OrbState = "idle" | "thinking" | "speaking" | "listening"

type TtsQueueItem = {
  displayText: string
  audioPromise: Promise<HTMLAudioElement>
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type SpeechRecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } }
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResult>; resultIndex: number }
type SpeechRecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start: () => void; stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanForTTS(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, "the equation")
    .replace(/\$[^$\n]+\$/g, (m) => m.slice(1, -1).replace(/\\[a-zA-Z]+/g, " ").replace(/[_^{}]/g, " "))
    .replace(/\[PHASE:[a-z_]+\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/^[-*]\s/gm, "")
    .replace(/\n{2,}/g, " ").replace(/\n/g, " ").trim()
}

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(/(?<=[.!?])\s+/)
  if (parts.length <= 1) return { sentences: [], remainder: buffer }
  return {
    sentences: parts.slice(0, -1).map(s => s.trim()).filter(s => s.length > 4),
    remainder: parts[parts.length - 1],
  }
}

function parsePhaseMarker(text: string): { clean: string; phase: string | null } {
  const match = text.match(/\[PHASE:([a-z_]+)\]/)
  return { phase: match ? match[1] : null, clean: text.replace(/\[PHASE:[a-z_]+\]/g, "").trim() }
}

function detectPhaseTransition(marker: string | null): LessonPhase | null {
  if (marker === "example_done") return "practice"
  if (marker === "practice_passed") return "challenge"
  if (marker === "challenge_passed" || marker === "complete") return "complete"
  return null
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function DarkMd({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children: c }) => <p className="mb-3 leading-[1.85] text-slate-200 text-[15px]">{c}</p>,
          strong: ({ children: c }) => <strong className="font-semibold text-white">{c}</strong>,
          em: ({ children: c }) => <em className="italic text-slate-300">{c}</em>,
          code: ({ children: c, className: cls }) =>
            cls?.includes("language-") ? <code className={cls}>{c}</code> : (
              <code className="bg-white/10 text-amber-300 px-1.5 py-0.5 rounded text-[0.87em] font-mono">{c}</code>
            ),
          pre: ({ children: c }) => (
            <pre className="bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto text-sm font-mono my-3 text-slate-200">{c}</pre>
          ),
          ul: ({ children: c }) => <ul className="list-none pl-0 mb-3 space-y-1.5">{c}</ul>,
          ol: ({ children: c }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-slate-200">{c}</ol>,
          li: ({ children: c }) => (
            <li className="leading-relaxed text-slate-200 flex gap-2">
              <span className="text-amber-400/40 mt-1.5 text-[10px] flex-shrink-0">▸</span>
              <span>{c}</span>
            </li>
          ),
          h1: ({ children: c }) => <h1 className="text-lg font-bold mb-3 mt-5 text-white">{c}</h1>,
          h2: ({ children: c }) => <h2 className="text-[10px] font-bold mb-2 mt-4 text-slate-400 uppercase tracking-widest">{c}</h2>,
          h3: ({ children: c }) => <h3 className="text-sm font-semibold mb-2 mt-3 text-slate-300">{c}</h3>,
          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-amber-400/40 pl-4 text-slate-400 my-3 italic">{c}</blockquote>
          ),
          table: ({ children: c }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm text-slate-200">{c}</table>
            </div>
          ),
          thead: ({ children: c }) => <thead className="border-b border-white/10">{c}</thead>,
          th: ({ children: c }) => <th className="text-left py-2 px-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{c}</th>,
          td: ({ children: c }) => <td className="py-2 px-3 border-b border-white/5 text-slate-300">{c}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

// ─── Orb ─────────────────────────────────────────────────────────────────────

function TutorOrb({ state, size = 96 }: { state: OrbState; size?: number }) {
  const gradient: Record<OrbState, string> = {
    idle:      "radial-gradient(circle at 35% 35%, #94a3b8, #1e293b)",
    thinking:  "radial-gradient(circle at 35% 35%, #a78bfa, #3730a3)",
    speaking:  "radial-gradient(circle at 35% 35%, #fbbf24, #92400e)",
    listening: "radial-gradient(circle at 35% 35%, #4ade80, #14532d)",
  }
  const glow: Record<OrbState, string> = {
    idle:      "rgba(148,163,184,0.2)",
    thinking:  "rgba(139,92,246,0.35)",
    speaking:  "rgba(251,191,36,0.4)",
    listening: "rgba(74,222,128,0.35)",
  }
  const anim: Record<OrbState, string | undefined> = {
    idle:      "orb-breathe 3s ease-in-out infinite",
    thinking:  "orb-think 2s ease-in-out infinite",
    speaking:  undefined,
    listening: "mic-pulse 2s ease-in-out infinite",
  }
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {state === "speaking" && [0, 1, 2].map(i => (
        <div key={i} className="absolute inset-0 rounded-full"
          style={{ border: "1.5px solid rgba(251,191,36,0.3)", animation: `ring-out 2s ease-out ${i * 0.65}s infinite` }} />
      ))}
      {state === "listening" && [0, 1].map(i => (
        <div key={i} className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(74,222,128,0.25)", animation: `ring-out 2.5s ease-out ${i}s infinite` }} />
      ))}
      <div className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          background: gradient[state],
          boxShadow: `0 0 ${size * 0.6}px ${size * 0.15}px ${glow[state]}, 0 0 ${size * 1.2}px ${size * 0.3}px ${glow[state].replace(/[\d.]+\)$/, "0.1)")}, inset 0 -${size * 0.08}px ${size * 0.2}px rgba(0,0,0,0.5)`,
          animation: anim[state],
        }} />
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceModeProps {
  onClose: () => void
  subject: string
  realSubjectName: string
  topic: string
  mode: "lesson" | "chat"
  nodeId: string
  studentId: string
  apiBase: string
  initialMessages: OnboardChatMessage[]
  weakTopics?: string[]
  lastSessionNote?: string | null
  /** Override the first message sent to the tutor on mount */
  startMessage?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VoiceMode({
  onClose, subject, realSubjectName, topic, mode, nodeId, studentId, apiBase, initialMessages,
  weakTopics = [], lastSessionNote, startMessage,
}: VoiceModeProps) {

  const [orbState, setOrbState]             = useState<OrbState>("idle")
  const [statusText, setStatusText]         = useState("Starting…")
  const [chatHistory, setChatHistory]       = useState<ChatMessage[]>([])
  const [revealedText, setRevealedText]     = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isStreaming, setIsStreaming]       = useState(false)
  const [showInput, setShowInput]           = useState(false)
  const [inputText, setInputText]           = useState("")
  const [muted, setMuted]                   = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [totalXp, setTotalXp]               = useState(0)

  const scrollRef            = useRef<HTMLDivElement>(null)
  const inputRef             = useRef<HTMLTextAreaElement>(null)
  const messagesRef          = useRef<OnboardChatMessage[]>(initialMessages)
  const ttsQueueRef          = useRef<TtsQueueItem[]>([])
  const isPlayingAudioRef    = useRef(false)
  const streamDoneRef        = useRef(false)
  const sentenceBufferRef    = useRef("")
  const recognitionRef       = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef          = useRef(false)
  const mutedRef             = useRef(false)
  const abortControllerRef   = useRef<AbortController | null>(null)
  const currentPhaseRef      = useRef<LessonPhase>("example")
  const totalXpRef           = useRef(0)
  const sendMessageRef       = useRef<(text: string) => void>(() => undefined)
  const revealedTextRef      = useRef("")
  // text to commit to history once TTS finishes
  const pendingCommitRef     = useRef<{ id: string; content: string } | null>(null)
  const interimTranscriptRef    = useRef("")
  const currentAudioRef         = useRef<HTMLAudioElement | null>(null)
  // Incremented by handleInterrupt/sendMessage — every async callback captures this
  // at call time and bails if it no longer matches (stale session)
  const sessionIdRef            = useRef(0)
  // Set by handleInterrupt so tutor auto-continues after answering user's question
  const interruptedLectureRef   = useRef(false)

  const resolveUrl = useCallback(
    (path: string) => apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // Auto-scroll when near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 200) el.scrollTop = el.scrollHeight
  }, [chatHistory, revealedText])

  useEffect(() => { if (showInput) inputRef.current?.focus() }, [showInput])

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const fetchTTSAudio = useCallback(async (text: string): Promise<HTMLAudioElement> => {
    const res = await fetch(resolveUrl("/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: "tutor" }),
    })
    if (!res.ok) throw new Error("TTS failed")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true })
    return audio
  }, [resolveUrl])

  // ── STT ──────────────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (mutedRef.current) return
    const Ctor = (
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined
    if (!Ctor) { setOrbState("listening"); setStatusText("Tap mic to speak"); return }
    const r = new Ctor()
    r.lang = "en-US"; r.interimResults = true; r.continuous = false
    recognitionRef.current = r
    interimTranscriptRef.current = ""
    setInterimTranscript("")

    r.onresult = (e) => {
      // Guard: if we were manually cancelled, ignore this event
      if (recognitionRef.current !== r) return
      let finalText = ""
      let interimText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript ?? ""
        if (e.results[i].isFinal) finalText += t
        else interimText += t
      }
      if (finalText.trim()) {
        recognitionRef.current = null
        interimTranscriptRef.current = ""
        setInterimTranscript("")
        sendMessageRef.current(finalText.trim())
      } else if (interimText) {
        interimTranscriptRef.current = interimText
        setInterimTranscript(interimText)
      }
    }
    r.onend = () => {
      // Guard: if we were manually cancelled, ignore
      if (recognitionRef.current !== r) return
      // Ended without a final result — if we have interim text, send it; else reset
      const pending = interimTranscriptRef.current.trim()
      recognitionRef.current = null
      interimTranscriptRef.current = ""
      setInterimTranscript("")
      if (pending) {
        sendMessageRef.current(pending)
      } else {
        setOrbState("idle")
        setStatusText("Tap mic to speak")
      }
    }
    r.onerror = () => {
      if (recognitionRef.current !== r) return
      recognitionRef.current = null
      interimTranscriptRef.current = ""
      setInterimTranscript("")
      setOrbState("idle")
      setStatusText("Tap mic to speak")
    }
    try { r.start(); setOrbState("listening"); setStatusText("Listening…") }
    catch { setOrbState("listening"); setStatusText("Tap mic to speak") }
  }, [])

  // ── Commit pending AI message to history ─────────────────────────────────────

  const commitPending = useCallback(() => {
    if (!pendingCommitRef.current) return
    const { id, content } = pendingCommitRef.current
    pendingCommitRef.current = null
    setChatHistory(prev => [...prev, { id, role: "assistant", content }])
    revealedTextRef.current = ""
    setRevealedText("")
  }, [])

  // ── Audio queue ───────────────────────────────────────────────────────────────

  const playNextInQueue = useCallback(() => {
    // Capture session at the moment this call was made
    const mySession = sessionIdRef.current

    if (ttsQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false
      if (streamDoneRef.current) {
        commitPending()
        // In lesson mode, if user interrupted mid-lecture to ask a question,
        // auto-continue the lecture after the answer finishes
        if (mode === "lesson" && interruptedLectureRef.current) {
          interruptedLectureRef.current = false
          setTimeout(() => {
            if (sessionIdRef.current === mySession) {
              sendMessageRef.current("Continue the lesson from where you left off.")
            }
          }, 600)
        } else {
          setOrbState("listening")
          setStatusText("Listening…")
          startListening()
        }
      }
      return
    }
    isPlayingAudioRef.current = true
    setOrbState("speaking"); setStatusText("Speaking…")

    const item = ttsQueueRef.current.shift()!
    // Show only the current sentence — not the whole accumulated text
    setRevealedText(item.displayText)

    item.audioPromise
      .then(audio => {
        // If session changed while audio was loading, discard — don't play stale audio
        if (sessionIdRef.current !== mySession) return
        currentAudioRef.current = audio
        audio.onended = () => { currentAudioRef.current = null; playNextInQueue() }
        audio.onerror = () => { currentAudioRef.current = null; playNextInQueue() }
        return audio.play()
      })
      .catch(() => {
        if (sessionIdRef.current !== mySession) return
        currentAudioRef.current = null; playNextInQueue()
      })
  }, [startListening, commitPending, mode])

  const enqueueSentence = useCallback((rawText: string) => {
    const displayText = rawText.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
    if (!displayText) return
    if (mutedRef.current) {
      revealedTextRef.current += (revealedTextRef.current ? " " : "") + displayText
      setRevealedText(revealedTextRef.current)
      return
    }
    const ttsText = cleanForTTS(displayText)
    if (ttsText.trim().length < 4) return
    ttsQueueRef.current.push({ displayText, audioPromise: fetchTTSAudio(ttsText) })
    if (!isPlayingAudioRef.current) playNextInQueue()
  }, [fetchTTSAudio, playNextInQueue])

  // ── Interrupt ─────────────────────────────────────────────────────────────────

  const handleInterrupt = useCallback(() => {
    // Increment session — all in-flight audio promises and catch blocks are now stale
    sessionIdRef.current++
    // Mark that we interrupted mid-lecture so tutor auto-continues after answering
    if (mode === "lesson") interruptedLectureRef.current = true
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    ttsQueueRef.current = []
    isPlayingAudioRef.current = false
    streamDoneRef.current = false
    pendingCommitRef.current = null
    revealedTextRef.current = ""; setRevealedText("")
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setOrbState("listening"); setStatusText("Listening…")
    startListening()
  }, [startListening, mode])

  const handleStop = useCallback(() => {
    sessionIdRef.current++
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    abortControllerRef.current?.abort()
    ttsQueueRef.current = []; isPlayingAudioRef.current = false; streamDoneRef.current = false
    pendingCommitRef.current = null
    recognitionRef.current?.stop()
    setIsStreaming(false)
    revealedTextRef.current = ""; setRevealedText("")
    setOrbState("idle"); setStatusText("Stopped — tap mic to continue")
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Each sendMessage gets its own session ID — used to detect stale async callbacks
    const mySession = ++sessionIdRef.current
    recognitionRef.current?.stop(); recognitionRef.current = null

    setChatHistory(prev => [...prev, { id: `user-${Date.now()}`, role: "user", content: trimmed }])
    setShowInput(false); setInputText(""); setError(null)
    messagesRef.current = [...messagesRef.current, { role: "user", content: trimmed }]

    setOrbState("thinking"); setStatusText("Thinking…")
    setIsStreaming(true)
    revealedTextRef.current = ""; setRevealedText("")
    streamDoneRef.current = false; sentenceBufferRef.current = ""
    ttsQueueRef.current = []; isPlayingAudioRef.current = false
    pendingCommitRef.current = null

    const abort = new AbortController()
    abortControllerRef.current = abort
    let fullText = ""
    let xpFromEvent = 0

    try {
      const payload: TutorMessageRequest = {
        studentId, subject: realSubjectName, message: trimmed,
        voiceMode: true, mode,
        topic: topic || undefined, nodeId: nodeId || undefined,
        sessionHistory: messagesRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }

      const response = await fetch(resolveUrl("/tutor/message/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abort.signal,
      })

      if (!response.ok || !response.body) throw new Error("Stream failed")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuffer += decoder.decode(value, { stream: true })
        const parts = sseBuffer.split("\n\n")
        sseBuffer = parts.pop() ?? ""
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data: ")) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(line.slice(6)) } catch { continue }
          if (event.type === "chunk") {
            // Stop processing if session changed (user interrupted)
            if (sessionIdRef.current !== mySession) break
            fullText += event.text as string
            setOrbState("speaking"); setStatusText("Speaking…")
            sentenceBufferRef.current += event.text as string
            const { sentences, remainder } = extractSentences(sentenceBufferRef.current)
            sentenceBufferRef.current = remainder
            for (const s of sentences) enqueueSentence(s)
          } else if (event.type === "done") {
            xpFromEvent = Number(event.xpGained ?? 0)
          }
        }
      }

      // Flush remaining buffer
      if (sentenceBufferRef.current.trim().length > 4) {
        enqueueSentence(sentenceBufferRef.current)
        sentenceBufferRef.current = ""
      }

      const { clean, phase: phaseMarker } = parsePhaseMarker(fullText)

      if (xpFromEvent > 0) {
        totalXpRef.current += xpFromEvent
        setTotalXp(totalXpRef.current)
      }

      // Store for commit after TTS finishes
      pendingCommitRef.current = { id: `ai-${Date.now()}`, content: clean }

      // Phase tracking (internal)
      const newPhase = detectPhaseTransition(phaseMarker)
      if (newPhase) currentPhaseRef.current = newPhase

      messagesRef.current = [...messagesRef.current, { role: "assistant", content: clean }]

      if ((phaseMarker === "complete" || phaseMarker === "challenge_passed") && nodeId && studentId) {
        void fetch(resolveUrl("/lesson/complete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, studentId, score: 8 }),
        })
      }

      setIsStreaming(false)
      streamDoneRef.current = true

      // If TTS already done (muted or short), commit immediately
      if (!isPlayingAudioRef.current && ttsQueueRef.current.length === 0) {
        commitPending()
        setOrbState("listening"); setStatusText("Listening…")
        startListening()
      }

    } catch (err) {
      // Stale session: either a newer sendMessage started, or handleInterrupt incremented the id.
      // Either way, don't touch UI state — someone else owns it now.
      if (sessionIdRef.current !== mySession) {
        setIsStreaming(false)
        return
      }
      const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"))
      pendingCommitRef.current = null
      setIsStreaming(false)
      if (!isAbort) { setError("Connection lost. Tap mic to try again."); setOrbState("idle"); setStatusText("") }
      else { setOrbState("idle"); setStatusText("Tap mic to speak") }
    }
  }, [studentId, realSubjectName, mode, topic, nodeId, resolveUrl, enqueueSentence, startListening, commitPending])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Auto-start ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoSentRef.current) return
    autoSentRef.current = true
    const msg = startMessage
      ?? (mode === "lesson" && topic
        ? `Start lesson on: ${topic}`
        : `__session_start__: Greet the student warmly, then ask them what specific topic or concept they want to work on today for ${realSubjectName}. Wait for their answer before teaching anything.`)
    void sendMessage(msg)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => () => { abortControllerRef.current?.abort(); recognitionRef.current?.stop() }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c1220] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{realSubjectName}</p>
          {topic && <p className="text-white font-semibold text-[15px] mt-0.5 truncate max-w-[220px]">{topic}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {totalXp > 0 && <span className="text-[12px] font-bold text-amber-400">+{totalXp} XP</span>}
          <button type="button" onClick={onClose}
            className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-[13px] text-slate-300 font-medium transition-colors">
            Exit
          </button>
        </div>
      </div>

      {/* ── Scrollable area: history + orb + current speech ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-5 flex flex-col min-h-full">

          {/* Past conversation (compact, dimmed) */}
          {chatHistory.length > 0 && (
            <div className="pt-6 flex flex-col gap-4">
              {chatHistory.map(msg =>
                msg.role === "assistant" ? (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm mt-0.5"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
                      🎓
                    </div>
                    <div className="flex-1 min-w-0 opacity-60">
                      <DarkMd>{msg.content}</DarkMd>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[14px] text-white/60 leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {msg.content}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Spacer pushes orb toward center/bottom */}
          <div className="flex-1 min-h-12" />

          {/* ── Orb + live speech ── */}
          <div className="flex flex-col items-center gap-7 py-10">

            <TutorOrb state={orbState} size={100} />

            {/* Thinking dots — waiting for first word */}
            {isStreaming && !revealedText && (
              <div className="flex gap-2.5 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-slate-600"
                    style={{ animation: `mic-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            )}

            {/* Live speech text — synced sentence-by-sentence with TTS */}
            {revealedText && (
              <div className="w-full text-center">
                <DarkMd className="[&_p]:text-center [&_p]:text-[16px] [&_p]:text-slate-100 [&_p]:leading-[1.75]">
                  {revealedText}
                </DarkMd>
                {isStreaming && (
                  <span className="inline-block w-[3px] h-[1em] bg-amber-400/70 ml-0.5 align-middle"
                    style={{ animation: "mic-pulse 1s ease-in-out infinite" }} />
                )}
              </div>
            )}

            {/* Idle — nothing shown yet */}
            {!isStreaming && !revealedText && chatHistory.length === 0 && (
              <p className="text-slate-600 text-sm">Starting up…</p>
            )}

            {/* Listening — show what's being heard, or a nudge */}
            {orbState === "listening" && (
              interimTranscript ? (
                <div className="max-w-md text-center">
                  <p className="text-white/80 text-[15px] leading-relaxed italic">"{interimTranscript}"</p>
                  <p className="text-green-400/50 text-[11px] mt-2 uppercase tracking-widest">Tap mic to send</p>
                </div>
              ) : (
                <p className="text-green-400/60 text-[13px] font-medium" style={{ animation: "orb-breathe 2s ease-in-out infinite" }}>
                  Speak — tap mic when done
                </p>
              )
            )}
          </div>

          {/* Text input (keyboard mode) */}
          {showInput && (
            <div className="mb-4 rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (inputText.trim()) void sendMessage(inputText.trim()) }
                  if (e.key === "Escape") setShowInput(false)
                }}
                placeholder="Type your message…"
                rows={3}
                className="w-full bg-transparent text-slate-200 text-sm resize-none outline-none placeholder-slate-600"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowInput(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5">Cancel</button>
                <button type="button" onClick={() => { if (inputText.trim()) void sendMessage(inputText.trim()) }}
                  disabled={!inputText.trim()}
                  className="text-xs font-semibold rounded-lg px-4 py-1.5 disabled:opacity-30 transition-all"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                  Send
                </button>
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-6 pb-2">
          <p className="text-center text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div className="flex-shrink-0 px-6 py-5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(12,18,32,0.97)" }}>
        <div className="flex items-center justify-center gap-5 mx-auto max-w-xl">

          {/* Keyboard toggle */}
          <button type="button" onClick={() => setShowInput(v => !v)}
            className={`rounded-full w-12 h-12 flex items-center justify-center border transition-all ${showInput ? "bg-amber-400/15 border-amber-400/40 text-amber-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/8"}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
            </svg>
          </button>

          {/* Main action button */}
          <button
            type="button"
            onClick={() => {
              setError(null)
              if (orbState === "speaking") handleInterrupt()
              else if (orbState === "thinking") handleStop()
              else if (orbState === "listening") {
                // Tap to finish — grab pending text, cancel recognition, then send
                const pending = interimTranscriptRef.current.trim()
                const rec = recognitionRef.current
                // Null the ref FIRST so onresult/onend guards fire and skip auto-send
                recognitionRef.current = null
                interimTranscriptRef.current = ""
                setInterimTranscript("")
                rec?.stop()
                if (pending) {
                  void sendMessage(pending)
                } else {
                  setOrbState("idle")
                  setStatusText("Tap mic to speak")
                }
              }
              else startListening()
            }}
            className="rounded-full w-20 h-20 flex items-center justify-center active:scale-95 transition-all"
            style={{
              background:
                orbState === "speaking"  ? "rgba(239,68,68,0.85)"
                : orbState === "thinking" ? "rgba(139,92,246,0.55)"
                : orbState === "listening" ? "rgba(74,222,128,0.85)"
                : "rgba(251,191,36,0.9)",
              boxShadow:
                orbState === "speaking"  ? "0 0 32px rgba(239,68,68,0.4)"
                : orbState === "thinking" ? "0 0 32px rgba(139,92,246,0.3)"
                : orbState === "listening" ? "0 0 32px rgba(74,222,128,0.45)"
                : "0 0 32px rgba(251,191,36,0.4)",
            }}
            title={orbState === "speaking" ? "Interrupt" : orbState === "thinking" ? "Stop" : "Speak"}
          >
            {orbState === "speaking" ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c1220" strokeWidth="1.8">
                <path d="M18 11V7a2 2 0 0 0-4 0v4M14 7V4a2 2 0 0 0-4 0v7M10 9V6a2 2 0 0 0-4 0v8l-2-2a2 2 0 0 0-2.83 2.83L5 18a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-7a2 2 0 0 0-4 0z" />
              </svg>
            ) : orbState === "thinking" ? (
              <span className="block rounded-sm bg-[#0c1220]" style={{ width: 20, height: 20 }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#0c1220">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              </svg>
            )}
          </button>

          {/* Mute */}
          <button type="button" onClick={() => setMuted(m => !m)}
            className={`rounded-full w-12 h-12 flex items-center justify-center border transition-all ${muted ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/8"}`}>
            {muted ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Status hint */}
        <p className="text-center text-slate-600 text-[11px] mt-3 tracking-wide">{statusText}</p>
      </div>
    </div>
  )
}
