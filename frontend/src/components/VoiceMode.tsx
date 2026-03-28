import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { OnboardChatMessage, TutorMessageRequest } from "@shared/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrbState = "idle" | "thinking" | "speaking" | "listening"

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanForTTS(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, "the equation")
    .replace(/\$[^$\n]+\$/g, (m) =>
      m
        .slice(1, -1)
        .replace(/\\[a-zA-Z]+/g, " ")
        .replace(/[_^{}]/g, " ")
    )
    .replace(/\[PHASE:[a-z_]+\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/^[-*]\s/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim()
}

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(/(?<=[.!?])\s+/)
  if (parts.length <= 1) return { sentences: [], remainder: buffer }
  return {
    sentences: parts
      .slice(0, -1)
      .map((s) => s.trim())
      .filter((s) => s.length > 4),
    remainder: parts[parts.length - 1],
  }
}

function parseClean(text: string): string {
  return text.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
}

function parsePhaseMarker(text: string): { clean: string; phase: string | null } {
  const match = text.match(/\[PHASE:([a-z_]+)\]/)
  return {
    phase: match ? match[1] : null,
    clean: text.replace(/\[PHASE:[a-z_]+\]/g, "").trim(),
  }
}

// ─── Small Orb ───────────────────────────────────────────────────────────────

function SmallOrb({ state }: { state: OrbState }) {
  const gradient: Record<OrbState, string> = {
    idle: "radial-gradient(circle at 35% 35%, #94a3b8, #1e293b)",
    thinking: "radial-gradient(circle at 35% 35%, #a78bfa, #3730a3)",
    speaking: "radial-gradient(circle at 35% 35%, #fbbf24, #92400e)",
    listening: "radial-gradient(circle at 35% 35%, #4ade80, #14532d)",
  }
  const glow: Record<OrbState, string> = {
    idle: "rgba(148,163,184,0.3)",
    thinking: "rgba(139,92,246,0.5)",
    speaking: "rgba(251,191,36,0.5)",
    listening: "rgba(74,222,128,0.5)",
  }
  const anim: Record<OrbState, string | undefined> = {
    idle: "orb-breathe 3s ease-in-out infinite",
    thinking: "orb-think 2s ease-in-out infinite",
    speaking: undefined,
    listening: "mic-pulse 2s ease-in-out infinite",
  }

  return (
    <div className="relative" style={{ width: 36, height: 36, flexShrink: 0 }}>
      {state === "speaking" &&
        [0, 1].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{
              border: "1.5px solid rgba(251,191,36,0.4)",
              animation: `ring-out 1.8s ease-out ${i * 0.7}s infinite`,
            }}
          />
        ))}
      <div
        className="rounded-full w-full h-full transition-all duration-700"
        style={{
          background: gradient[state],
          boxShadow: `0 0 16px 4px ${glow[state]}, inset 0 -4px 10px rgba(0,0,0,0.4)`,
          animation: anim[state],
        }}
      />
    </div>
  )
}

// ─── Board message renderer ───────────────────────────────────────────────────

function BoardMessage({
  msg,
  streamingSuffix,
}: {
  msg: OnboardChatMessage
  streamingSuffix?: string
}) {
  const content = streamingSuffix !== undefined ? msg.content + streamingSuffix : msg.content

  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-5">
        <div
          className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-3 text-sm text-white/90 leading-relaxed"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
        <span className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-widest">Tutor</span>
      </div>
      <div className="board-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <p className="mb-4 leading-[1.85] text-slate-200 text-[15px]">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
            code: ({ children, className }) =>
              className?.includes("language-") ? (
                <code className={className}>{children}</code>
              ) : (
                <code className="bg-white/10 text-amber-300 px-1.5 py-0.5 rounded text-[0.87em] font-mono">
                  {children}
                </code>
              ),
            pre: ({ children }) => (
              <pre className="bg-white/5 border border-white/10 rounded-xl p-5 overflow-x-auto text-sm font-mono my-5 text-slate-200">
                {children}
              </pre>
            ),
            ul: ({ children }) => (
              <ul className="list-none pl-0 mb-4 space-y-2">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-200">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed text-slate-200 flex gap-2">
                <span className="text-amber-400/50 mt-1.5 text-xs flex-shrink-0">▸</span>
                <span>{children}</span>
              </li>
            ),
            h1: ({ children }) => (
              <h1 className="text-lg font-bold mb-3 mt-6 text-white">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xs font-bold mb-2 mt-5 text-slate-400 uppercase tracking-widest">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mb-2 mt-4 text-slate-300">{children}</h3>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-3 border-amber-400/40 pl-4 text-slate-400 my-4 italic">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-5">
                <table className="w-full border-collapse text-sm text-slate-200">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="border-b border-white/10">{children}</thead>,
            th: ({ children }) => (
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="py-2 px-3 border-b border-white/5 text-slate-300">{children}</td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        {streamingSuffix !== undefined && (
          <span
            className="inline-block w-[3px] h-[1em] bg-amber-400/80 ml-0.5 align-middle"
            style={{ animation: "mic-pulse 1s ease-in-out infinite" }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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
}

export default function VoiceMode({
  onClose,
  subject,
  realSubjectName,
  topic,
  mode,
  nodeId,
  studentId,
  apiBase,
  initialMessages,
}: VoiceModeProps) {
  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [statusText, setStatusText] = useState("Starting…")
  const [transcript, setTranscript] = useState<OnboardChatMessage[]>([])
  const [streamingText, setStreamingText] = useState<string>("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputText, setInputText] = useState("")
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lessonComplete, setLessonComplete] = useState(false)

  const boardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<OnboardChatMessage[]>(initialMessages)
  const ttsQueueRef = useRef<Promise<HTMLAudioElement>[]>([])
  const isPlayingAudioRef = useRef(false)
  const streamDoneRef = useRef(false)
  const sentenceBufferRef = useRef("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)
  const mutedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const resolveUrl = useCallback(
    (path: string) =>
      apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // Auto-scroll board as content arrives
  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.scrollTop = boardRef.current.scrollHeight
    }
  }, [transcript, streamingText])

  // Focus input when shown
  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const fetchTTSAudio = useCallback(
    async (text: string): Promise<HTMLAudioElement> => {
      const response = await fetch(resolveUrl("/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "tutor" }),
      })
      if (!response.ok) throw new Error("TTS failed")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true })
      return audio
    },
    [resolveUrl]
  )

  // ── STT ──────────────────────────────────────────────────────────────────────

  // sendMessageRef to avoid circular deps
  const sendMessageRef = useRef<(text: string) => void>(() => undefined)

  const startListening = useCallback(() => {
    if (mutedRef.current) return
    const Ctor = (
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined

    if (!Ctor) {
      setStatusText("Tap mic to speak")
      setOrbState("listening")
      return
    }

    const r = new Ctor()
    r.lang = "en-US"
    r.interimResults = false
    r.continuous = false
    recognitionRef.current = r

    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? ""
      if (text.trim()) {
        recognitionRef.current = null
        sendMessageRef.current(text.trim())
      }
    }
    r.onend = () => {
      // stayed silent — just wait
    }
    r.onerror = () => {
      setStatusText("Tap mic to speak")
    }

    try {
      r.start()
      setOrbState("listening")
      setStatusText("Listening…")
    } catch {
      setStatusText("Tap mic to speak")
      setOrbState("listening")
    }
  }, [])

  // ── Audio queue ───────────────────────────────────────────────────────────────

  const playNextInQueue = useCallback(() => {
    if (ttsQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false
      if (streamDoneRef.current) {
        setOrbState("listening")
        setStatusText("Listening…")
        startListening()
      }
      return
    }

    isPlayingAudioRef.current = true
    setOrbState("speaking")
    setStatusText("Speaking…")

    const audioPromise = ttsQueueRef.current.shift()!
    audioPromise
      .then((audio) => {
        audio.onended = () => playNextInQueue()
        audio.onerror = () => playNextInQueue()
        return audio.play()
      })
      .catch(() => playNextInQueue())
  }, [startListening])

  const enqueueSentence = useCallback(
    (text: string) => {
      if (mutedRef.current) return
      const cleaned = cleanForTTS(text)
      if (cleaned.trim().length < 4) return
      const audioPromise = fetchTTSAudio(cleaned)
      ttsQueueRef.current.push(audioPromise)
      if (!isPlayingAudioRef.current) {
        playNextInQueue()
      }
    },
    [fetchTTSAudio, playNextInQueue]
  )

  // ── Send message ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      recognitionRef.current?.stop()
      recognitionRef.current = null

      const userMsg: OnboardChatMessage = { role: "user", content: trimmed }
      messagesRef.current = [...messagesRef.current, userMsg]
      setTranscript((prev) => [...prev, userMsg])
      setShowInput(false)
      setInputText("")
      setError(null)

      setOrbState("thinking")
      setStatusText("Thinking…")
      setIsStreaming(true)
      setStreamingText("")
      streamDoneRef.current = false
      sentenceBufferRef.current = ""
      ttsQueueRef.current = []
      isPlayingAudioRef.current = false

      const abort = new AbortController()
      abortControllerRef.current = abort

      let fullText = ""

      try {
        const payload: TutorMessageRequest = {
          studentId,
          subject: realSubjectName,
          message: trimmed,
          voiceMode: true,
          mode,
          topic: topic || undefined,
          nodeId: nodeId || undefined,
          sessionHistory: messagesRef.current.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
              fullText += event.text as string
              setStreamingText(parseClean(fullText))
              setOrbState("speaking")
              setStatusText("Speaking…")

              sentenceBufferRef.current += event.text as string
              const { sentences, remainder } = extractSentences(sentenceBufferRef.current)
              sentenceBufferRef.current = remainder
              for (const s of sentences) enqueueSentence(s)
            }
          }
        }

        // Flush remaining buffer
        if (sentenceBufferRef.current.trim().length > 4) {
          enqueueSentence(sentenceBufferRef.current)
          sentenceBufferRef.current = ""
        }

        const { clean, phase } = parsePhaseMarker(fullText)

        // Check for lesson completion
        if (phase === "complete" && nodeId && studentId) {
          setLessonComplete(true)
          void fetch(resolveUrl("/lesson/complete"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId, studentId, score: 8 }),
          })
        }

        const assistantMsg: OnboardChatMessage = { role: "assistant", content: clean }
        messagesRef.current = [...messagesRef.current, assistantMsg]
        setTranscript((prev) => [...prev, assistantMsg])
        setStreamingText("")
        setIsStreaming(false)

        streamDoneRef.current = true

        if (!isPlayingAudioRef.current && ttsQueueRef.current.length === 0) {
          setOrbState("listening")
          setStatusText("Listening…")
          startListening()
        }
      } catch (err) {
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"))

        if (fullText.trim()) {
          const clean = parseClean(fullText)
          setTranscript((prev) => [...prev, { role: "assistant", content: clean }])
        }
        setStreamingText("")
        setIsStreaming(false)

        if (!isAbort) {
          setError("Connection lost. Tap mic to try again.")
          setOrbState("idle")
          setStatusText("")
        } else {
          setOrbState("idle")
          setStatusText("Stopped")
        }
      }
    },
    [studentId, realSubjectName, mode, topic, nodeId, resolveUrl, enqueueSentence, startListening]
  )

  // Wire sendMessageRef to avoid stale closure in STT callbacks
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // ── Auto-start ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoSentRef.current) {
      autoSentRef.current = true
      const msg =
        mode === "lesson" && topic
          ? `Start lesson on: ${topic}`
          : `Hello! I'm ready to learn about ${realSubjectName}.`
      void sendMessage(msg)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync muted ref
  useEffect(() => { mutedRef.current = muted }, [muted])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      recognitionRef.current?.stop()
    }
  }, [])

  // ── Stop handler ─────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    ttsQueueRef.current = []
    isPlayingAudioRef.current = false
    streamDoneRef.current = false
    recognitionRef.current?.stop()
    setIsStreaming(false)
    setStreamingText("")
    setOrbState("idle")
    setStatusText("Stopped — tap mic to continue")
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const isBusy = orbState === "thinking" || orbState === "speaking" || isStreaming

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c1220] select-none">

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <p className="text-[12px] text-slate-500 font-medium uppercase tracking-wider">{realSubjectName}</p>
          {topic && (
            <p className="text-white font-semibold text-[15px] mt-0.5 truncate max-w-[260px]">{topic}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className={`rounded-full w-9 h-9 flex items-center justify-center border transition-all ${
              muted
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}
            title={muted ? "Unmute voice" : "Mute voice"}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-[13px] text-slate-300 font-medium transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* ── Board (scrollable transcript) ── */}
      <div
        ref={boardRef}
        className="flex-1 overflow-y-auto px-6 py-8"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="mx-auto max-w-2xl">

          {/* Empty state */}
          {transcript.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <SmallOrb state="thinking" />
              <p className="text-slate-500 text-sm">Starting session…</p>
            </div>
          )}

          {/* Committed messages */}
          {transcript.map((msg, i) => (
            <BoardMessage key={i} msg={msg} />
          ))}

          {/* Current streaming message */}
          {isStreaming && streamingText && (
            <BoardMessage
              msg={{ role: "assistant", content: streamingText }}
              streamingSuffix=""
            />
          )}

          {/* Thinking indicator (no text yet) */}
          {isStreaming && !streamingText && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-widest">Tutor</span>
              </div>
              <div className="flex gap-1.5 items-center h-6">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-slate-500"
                    style={{ animation: `mic-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lesson complete banner */}
          {lessonComplete && (
            <div
              className="mt-4 rounded-2xl p-5 text-center"
              style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <p className="text-green-400 font-semibold text-sm mb-1">Lesson complete</p>
              <p className="text-slate-400 text-xs">Topic mastered and saved to your roadmap.</p>
            </div>
          )}

          {/* Inline text input */}
          {showInput && (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (inputText.trim()) void sendMessage(inputText.trim())
                  }
                  if (e.key === "Escape") setShowInput(false)
                }}
                placeholder="Type your message…"
                rows={3}
                className="w-full bg-transparent text-slate-200 text-sm resize-none outline-none placeholder-slate-600"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowInput(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { if (inputText.trim()) void sendMessage(inputText.trim()) }}
                  disabled={!inputText.trim()}
                  className="text-xs font-semibold rounded-lg px-4 py-1.5 transition-all disabled:opacity-30"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Bottom padding so content isn't hidden behind bottom bar */}
          <div className="h-4" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-6 pb-2">
          <p className="text-center text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(12,18,32,0.95)" }}
      >
        <div className="flex items-center justify-between mx-auto max-w-2xl">

          {/* Orb + status */}
          <div className="flex items-center gap-3">
            <SmallOrb state={orbState} />
            <span className="text-slate-400 text-sm min-w-0 truncate max-w-[160px]">
              {statusText}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">

            {/* Keyboard toggle */}
            <button
              type="button"
              onClick={() => setShowInput((v) => !v)}
              className={`rounded-full w-11 h-11 flex items-center justify-center border transition-all ${
                showInput
                  ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              }`}
              title="Type a message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
              </svg>
            </button>

            {/* Main action: Stop (busy) or Mic (idle/listening) */}
            {isBusy ? (
              <button
                type="button"
                onClick={handleStop}
                className="rounded-full w-14 h-14 flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 0 20px rgba(255,255,255,0.15)",
                }}
                title="Stop"
              >
                <span
                  className="block rounded-sm"
                  style={{ width: 18, height: 18, background: "#0c1220" }}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  startListening()
                }}
                className="rounded-full w-14 h-14 flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: orbState === "listening"
                    ? "rgba(74,222,128,0.85)"
                    : "rgba(251,191,36,0.85)",
                  boxShadow: orbState === "listening"
                    ? "0 0 24px rgba(74,222,128,0.4)"
                    : "0 0 24px rgba(251,191,36,0.35)",
                }}
                title="Speak"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#0c1220">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
