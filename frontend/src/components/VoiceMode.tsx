import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentActivity, OnboardChatMessage, RoadmapNode, TutorMessageRequest } from "@shared/types"

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
  // Split on sentence-ending punctuation followed by whitespace
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

// ─── Orb component ────────────────────────────────────────────────────────────

function Orb({ state }: { state: OrbState }) {
  const gradient: Record<OrbState, string> = {
    idle: "radial-gradient(circle at 35% 35%, #94a3b8, #1e293b)",
    thinking: "radial-gradient(circle at 35% 35%, #a78bfa, #3730a3)",
    speaking: "radial-gradient(circle at 35% 35%, #fbbf24, #92400e)",
    listening: "radial-gradient(circle at 35% 35%, #4ade80, #14532d)",
  }
  const glow: Record<OrbState, string> = {
    idle: "rgba(148,163,184,0.25)",
    thinking: "rgba(139,92,246,0.45)",
    speaking: "rgba(251,191,36,0.45)",
    listening: "rgba(74,222,128,0.45)",
  }
  const anim: Record<OrbState, string | undefined> = {
    idle: "orb-breathe 3s ease-in-out infinite",
    thinking: "orb-think 2s ease-in-out infinite",
    speaking: undefined,
    listening: "mic-pulse 2s ease-in-out infinite",
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      {/* Expanding rings — speaking state */}
      {state === "speaking" &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 208,
              height: 208,
              border: "2px solid rgba(251,191,36,0.35)",
              animation: `ring-out 1.8s ease-out ${i * 0.6}s infinite`,
            }}
          />
        ))}
      {/* Main orb */}
      <div
        className="rounded-full transition-all duration-700"
        style={{
          width: 208,
          height: 208,
          background: gradient[state],
          boxShadow: `0 0 70px 24px ${glow[state]}, inset 0 -14px 40px rgba(0,0,0,0.45)`,
          animation: anim[state],
        }}
      />
      {/* Mic icon overlay when listening */}
      {state === "listening" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="white"
            opacity="0.9"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
          </svg>
        </div>
      )}
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
  const [statusText, setStatusText] = useState("Starting session…")
  const [transcript, setTranscript] = useState<OnboardChatMessage[]>([])
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs — never trigger re-renders for these
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

  // ── TTS fetch ────────────────────────────────────────────────────────────────

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

  const startListening = useCallback(() => {
    if (mutedRef.current) return
    const Ctor = (
      window.SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined

    if (!Ctor) {
      setStatusText("Tap to speak (auto-listen not supported in this browser)")
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
        void sendMessage(text.trim())
      }
    }
    r.onend = () => {
      // If we're still in listening state and recognition ended without result, restart
      // (happens when no speech detected — just keep listening)
    }
    r.onerror = () => {
      setStatusText("Tap to speak")
    }

    try {
      r.start()
      setOrbState("listening")
      setStatusText("Listening…")
    } catch {
      setStatusText("Tap to speak")
    }
  }, []) // sendMessage added below via ref trick

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

      // Stop any active recognition
      recognitionRef.current?.stop()
      recognitionRef.current = null

      const userMsg: OnboardChatMessage = { role: "user", content: trimmed }
      messagesRef.current = [...messagesRef.current, userMsg]
      setTranscript((prev) => [...prev, userMsg])

      setOrbState("thinking")
      setStatusText("Thinking…")
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
              sentenceBufferRef.current += event.text as string

              const { sentences, remainder } = extractSentences(sentenceBufferRef.current)
              sentenceBufferRef.current = remainder
              for (const s of sentences) enqueueSentence(s)
            }
          }
        }

        // Flush remaining sentence buffer
        if (sentenceBufferRef.current.trim().length > 4) {
          enqueueSentence(sentenceBufferRef.current)
          sentenceBufferRef.current = ""
        }

        const clean = parseClean(fullText)
        const assistantMsg: OnboardChatMessage = { role: "assistant", content: clean }
        messagesRef.current = [...messagesRef.current, assistantMsg]
        setTranscript((prev) => [...prev, assistantMsg])

        streamDoneRef.current = true

        // If nothing was queued (muted or empty), go straight to listening
        if (!isPlayingAudioRef.current && ttsQueueRef.current.length === 0) {
          setOrbState("listening")
          setStatusText("Listening…")
          startListening()
        }
      } catch (err) {
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"))
        if (!isAbort) {
          setError("Connection lost. Tap to try again.")
          setOrbState("idle")
          setStatusText("")
        }
      }
    },
    [studentId, realSubjectName, mode, topic, nodeId, resolveUrl, enqueueSentence, startListening]
  )

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

  // ── Render ────────────────────────────────────────────────────────────────────

  const recentTranscript = transcript.slice(-4)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0F172A] px-6 py-10 select-none">

      {/* Top bar */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{realSubjectName}</p>
          {topic && (
            <p className="text-white font-bold text-base mt-0.5 truncate max-w-[260px]">{topic}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-sm text-white font-semibold transition-colors"
        >
          Exit voice mode
        </button>
      </div>

      {/* Orb + status */}
      <div className="flex flex-col items-center gap-6">
        <Orb state={orbState} />

        <div className="flex flex-col items-center gap-1">
          <p className="text-white text-lg font-semibold tracking-wide min-h-[1.75rem]">
            {statusText}
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Manual speak button — always visible as fallback */}
        {(orbState === "listening" || orbState === "idle") && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              startListening()
            }}
            className="mt-2 rounded-full bg-white/10 hover:bg-white/20 px-6 py-3 text-white text-sm font-semibold border border-white/20 transition-all active:scale-95"
          >
            Tap to speak
          </button>
        )}
      </div>

      {/* Recent transcript */}
      <div className="w-full max-w-lg space-y-3 max-h-48 overflow-y-auto">
        {recentTranscript.map((msg, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-white/10 text-white ml-8"
                : "bg-[#1e293b] text-slate-200 mr-8"
            }`}
          >
            <span className="font-semibold text-xs uppercase tracking-wider opacity-60 block mb-1">
              {msg.role === "user" ? "You" : "Tutor"}
            </span>
            {msg.content.length > 200 ? `${msg.content.slice(0, 200)}…` : msg.content}
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={`rounded-full w-12 h-12 flex items-center justify-center border transition-all ${
            muted
              ? "bg-red-500/20 border-red-500/40 text-red-400"
              : "bg-white/10 border-white/20 text-white hover:bg-white/20"
          }`}
          title={muted ? "Unmute" : "Mute voice"}
        >
          {muted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            abortControllerRef.current?.abort()
            ttsQueueRef.current = []
            isPlayingAudioRef.current = false
            recognitionRef.current?.stop()
            setOrbState("idle")
            setStatusText("Stopped")
          }}
          className="rounded-full w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
          title="Stop"
        >
          <span className="w-4 h-4 rounded-sm bg-white block" />
        </button>
      </div>
    </div>
  )
}
