import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { AgentActivity, OnboardChatMessage, TutorMessageRequest } from "@shared/types"

// ─── Lesson phase types ───────────────────────────────────────────────────────

type LessonPhase = "example" | "practice" | "challenge" | "complete"

type BlockType =
  | "greeting"
  | "lecture"
  | "user"
  | "problem"
  | "feedback-pass"
  | "feedback-wrong"
  | "debrief"
  | "phase-divider"
  | "adaptation"

type TtsQueueItem = {
  displayText: string          // shown on board when this sentence plays
  audioPromise: Promise<HTMLAudioElement>
}

type BoardBlock = {
  id: string
  type: BlockType
  content: string
  difficulty?: "practice" | "challenge"
  xpGained?: number
  xpTotal?: number
  targetPhase?: LessonPhase
  reason?: string
}

// ─── Speech recognition types ────────────────────────────────────────────────

type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start: () => void; stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// ─── Helpers ─────────────────────────────────────────────────────────────────

type OrbState = "idle" | "thinking" | "speaking" | "listening"

function cleanForTTS(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, "the equation")
    .replace(/\$[^$\n]+\$/g, (m) => m.slice(1,-1).replace(/\\[a-zA-Z]+/g," ").replace(/[_^{}]/g," "))
    .replace(/\[PHASE:[a-z_]+\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`[^`]+`/g, (m) => m.slice(1,-1))
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/^[-*]\s/gm, "")
    .replace(/\n{2,}/g, " ").replace(/\n/g, " ").trim()
}

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(/(?<=[.!?])\s+/)
  if (parts.length <= 1) return { sentences: [], remainder: buffer }
  return {
    sentences: parts.slice(0,-1).map(s => s.trim()).filter(s => s.length > 4),
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

function getBlockInfo(
  marker: string | null,
  phase: LessonPhase,
  challengeQuestionAsked: boolean,
): { blockType: BlockType; difficulty?: "practice" | "challenge" } {
  if (phase === "example") return { blockType: "lecture" }
  if (phase === "practice") {
    if (marker === "practice") return { blockType: "problem", difficulty: "practice" }
    if (marker === "practice_passed") return { blockType: "feedback-pass" }
    return { blockType: "feedback-wrong" }
  }
  if (phase === "challenge") {
    if (!challengeQuestionAsked) return { blockType: "problem", difficulty: "challenge" }
    if (marker === "challenge_passed" || marker === "complete") return { blockType: "feedback-pass" }
    return { blockType: "feedback-wrong" }
  }
  if (phase === "complete") return { blockType: "debrief" }
  return { blockType: "lecture" }
}

// ─── Dark markdown renderer ───────────────────────────────────────────────────

function DarkMd({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children: c }) => <p className="mb-3.5 leading-[1.85] text-slate-200 text-[15px]">{c}</p>,
          strong: ({ children: c }) => <strong className="font-semibold text-white">{c}</strong>,
          em: ({ children: c }) => <em className="italic text-slate-300">{c}</em>,
          code: ({ children: c, className: cls }) =>
            cls?.includes("language-") ? <code className={cls}>{c}</code> : (
              <code className="bg-white/10 text-amber-300 px-1.5 py-0.5 rounded text-[0.87em] font-mono">{c}</code>
            ),
          pre: ({ children: c }) => (
            <pre className="bg-white/5 border border-white/10 rounded-xl p-5 overflow-x-auto text-sm font-mono my-4 text-slate-200">{c}</pre>
          ),
          ul: ({ children: c }) => <ul className="list-none pl-0 mb-4 space-y-2">{c}</ul>,
          ol: ({ children: c }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-200">{c}</ol>,
          li: ({ children: c }) => (
            <li className="leading-relaxed text-slate-200 flex gap-2">
              <span className="text-amber-400/50 mt-1.5 text-[10px] flex-shrink-0">▸</span>
              <span>{c}</span>
            </li>
          ),
          h1: ({ children: c }) => <h1 className="text-lg font-bold mb-3 mt-6 text-white">{c}</h1>,
          h2: ({ children: c }) => <h2 className="text-[10px] font-bold mb-2 mt-5 text-slate-400 uppercase tracking-widest">{c}</h2>,
          h3: ({ children: c }) => <h3 className="text-sm font-semibold mb-2 mt-4 text-slate-300">{c}</h3>,
          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-amber-400/40 pl-4 text-slate-400 my-4 italic">{c}</blockquote>
          ),
          table: ({ children: c }) => (
            <div className="overflow-x-auto my-4">
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

// ─── Board block components ───────────────────────────────────────────────────

function GreetingBlock({ content }: { content: string }) {
  return (
    <div className="mb-6 flex gap-3">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
        style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
        🎓
      </div>
      <div className="flex-1">
        <p className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-widest mb-1.5">Tutor</p>
        <p className="text-slate-400 text-[14px] italic leading-relaxed">"{content}"</p>
      </div>
    </div>
  )
}

function LectureBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
        <span className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-widest">Tutor</span>
      </div>
      <DarkMd>{content}</DarkMd>
      {isStreaming && (
        <span className="inline-block w-[3px] h-[1em] bg-amber-400/80 ml-0.5 align-middle"
          style={{ animation: "mic-pulse 1s ease-in-out infinite" }} />
      )}
    </div>
  )
}

function UserBlock({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-5">
      <div className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-3 text-sm text-white/90 leading-relaxed"
        style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.11)" }}>
        {content}
      </div>
    </div>
  )
}

function ProblemBlock({ content, difficulty, isStreaming }: { content: string; difficulty: "practice" | "challenge"; isStreaming?: boolean }) {
  const isChallenge = difficulty === "challenge"
  return (
    <div className="mb-8 rounded-2xl overflow-hidden"
      style={{ background: isChallenge ? "#120a1a" : "#0a1220", border: `1px solid ${isChallenge ? "rgba(245,158,11,0.25)" : "rgba(96,165,250,0.2)"}` }}>
      <div className="px-5 py-3 flex items-center gap-2.5"
        style={{ background: isChallenge ? "rgba(245,158,11,0.06)" : "rgba(96,165,250,0.06)", borderBottom: `1px solid ${isChallenge ? "rgba(245,158,11,0.12)" : "rgba(96,165,250,0.1)"}` }}>
        <span className="text-base">{isChallenge ? "⚡" : "📝"}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: isChallenge ? "#f59e0b" : "#60a5fa" }}>
          {isChallenge ? "Challenge" : "Practice Problem"}
        </span>
      </div>
      <div className="px-5 py-5">
        <DarkMd>{content}</DarkMd>
        {isStreaming && (
          <span className="inline-block w-[3px] h-[1em] bg-amber-400/80 ml-0.5 align-middle"
            style={{ animation: "mic-pulse 1s ease-in-out infinite" }} />
        )}
      </div>
    </div>
  )
}

function FeedbackPassBlock({ content, xpGained }: { content: string; xpGained?: number }) {
  return (
    <div className="mb-8 rounded-2xl overflow-hidden"
      style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.18)" }}>
      <div className="px-5 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
        <span className="text-[11px] font-bold uppercase tracking-widest text-green-400">✓ Correct</span>
        {xpGained && xpGained > 0 && (
          <span className="text-[11px] font-bold text-amber-400">+{xpGained} XP</span>
        )}
      </div>
      <div className="px-5 py-4">
        <DarkMd>{content}</DarkMd>
      </div>
    </div>
  )
}

function FeedbackWrongBlock({ content }: { content: string }) {
  return (
    <div className="mb-8 rounded-2xl overflow-hidden"
      style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
      <div className="px-5 py-2.5"
        style={{ borderBottom: "1px solid rgba(239,68,68,0.08)" }}>
        <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Not quite — let's look at this</span>
      </div>
      <div className="px-5 py-4">
        <DarkMd>{content}</DarkMd>
      </div>
    </div>
  )
}

function DebriefBlock({ content, xpTotal }: { content: string; xpTotal: number }) {
  return (
    <div className="mb-8 rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.06), rgba(139,92,246,0.06))", border: "1px solid rgba(251,191,36,0.2)" }}>
      <div className="px-6 pt-6 pb-4 text-center"
        style={{ borderBottom: "1px solid rgba(251,191,36,0.1)" }}>
        <div className="text-4xl mb-3">🎓</div>
        <p className="text-white font-bold text-lg mb-1">Lesson Complete</p>
        {xpTotal > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-amber-400 font-bold text-2xl">+{xpTotal}</span>
            <span className="text-slate-500 text-sm">XP earned</span>
          </div>
        )}
      </div>
      <div className="px-6 py-5">
        <DarkMd>{content}</DarkMd>
      </div>
    </div>
  )
}

function PhaseDivider({ targetPhase }: { targetPhase: LessonPhase }) {
  const config: Record<LessonPhase, { color: string; bg: string; border: string; icon: string; label: string }> = {
    practice: { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.18)", icon: "📝", label: "Practice" },
    challenge: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", icon: "⚡", label: "Challenge" },
    complete: { color: "#4ade80", bg: "rgba(74,222,128,0.06)", border: "rgba(74,222,128,0.15)", icon: "🎓", label: "Complete" },
    example: { color: "#94a3b8", bg: "transparent", border: "transparent", icon: "📖", label: "Lecture" },
  }
  const c = config[targetPhase]
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5"
        style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
        <span>{c.icon}</span>
        <span>{c.label}</span>
      </div>
      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  )
}

function AdaptationCard({ reason }: { reason: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
      <span className="text-purple-400 text-base flex-shrink-0">🧠</span>
      <p className="text-purple-300 text-sm">{reason}</p>
    </div>
  )
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function RenderBlock({ block, isStreaming }: { block: BoardBlock; isStreaming?: boolean }) {
  switch (block.type) {
    case "greeting": return <GreetingBlock content={block.content} />
    case "lecture": return <LectureBlock content={block.content} isStreaming={isStreaming} />
    case "user": return <UserBlock content={block.content} />
    case "problem": return <ProblemBlock content={block.content} difficulty={block.difficulty ?? "practice"} isStreaming={isStreaming} />
    case "feedback-pass": return <FeedbackPassBlock content={block.content} xpGained={block.xpGained} />
    case "feedback-wrong": return <FeedbackWrongBlock content={block.content} />
    case "debrief": return <DebriefBlock content={block.content} xpTotal={block.xpTotal ?? 0} />
    case "phase-divider": return block.targetPhase ? <PhaseDivider targetPhase={block.targetPhase} /> : null
    case "adaptation": return <AdaptationCard reason={block.reason ?? "Adjusting approach based on your responses"} />
    default: return null
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
      {state === "speaking" && [0,1].map(i => (
        <div key={i} className="absolute inset-0 rounded-full"
          style={{ border: "1.5px solid rgba(251,191,36,0.4)", animation: `ring-out 1.8s ease-out ${i * 0.7}s infinite` }} />
      ))}
      <div className="rounded-full w-full h-full transition-all duration-700"
        style={{ background: gradient[state], boxShadow: `0 0 16px 4px ${glow[state]}, inset 0 -4px 10px rgba(0,0,0,0.4)`, animation: anim[state] }} />
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
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  weakTopics = [],
  lastSessionNote,
}: VoiceModeProps) {
  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [statusText, setStatusText] = useState("Starting…")
  const [boardBlocks, setBoardBlocks] = useState<BoardBlock[]>([])
  // revealedText = only the text that has already been spoken aloud (synced to TTS)
  const [revealedText, setRevealedText] = useState("")
  const [streamingBlockType, setStreamingBlockType] = useState<BlockType>("lecture")
  const [streamingDifficulty, setStreamingDifficulty] = useState<"practice" | "challenge" | undefined>(undefined)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputText, setInputText] = useState("")
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentLessonPhase, setCurrentLessonPhase] = useState<LessonPhase>("example")
  const [totalXp, setTotalXp] = useState(0)

  const boardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<OnboardChatMessage[]>(initialMessages)
  const ttsQueueRef = useRef<TtsQueueItem[]>([])
  const isPlayingAudioRef = useRef(false)
  const streamDoneRef = useRef(false)
  const sentenceBufferRef = useRef("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)
  const mutedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentLessonPhaseRef = useRef<LessonPhase>("example")
  const challengeQuestionAskedRef = useRef(false)
  const totalXpRef = useRef(0)
  const sendMessageRef = useRef<(text: string) => void>(() => undefined)
  const revealedTextRef = useRef("")
  const streamingBlockTypeRef = useRef<BlockType>("lecture")
  const streamingDifficultyRef = useRef<"practice" | "challenge" | undefined>(undefined)

  const resolveUrl = useCallback(
    (path: string) => apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // Personalized opening greeting shown immediately
  const openingGreeting = useMemo(() => {
    if (mode !== "lesson") return null
    if (lastSessionNote) return `Last time: ${lastSessionNote}. Building from there today.`
    if (weakTopics.length > 0) return `I'll pay attention to ${weakTopics[0]} — that's where we'll make the most progress.`
    return `Let's work through ${topic} properly.`
  }, [mode, lastSessionNote, weakTopics, topic])

  // Auto-scroll only when near bottom
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 120) el.scrollTop = el.scrollHeight
  }, [boardBlocks, revealedText])

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const fetchTTSAudio = useCallback(async (text: string): Promise<HTMLAudioElement> => {
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
    r.lang = "en-US"; r.interimResults = false; r.continuous = false
    recognitionRef.current = r
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? ""
      if (text.trim()) { recognitionRef.current = null; sendMessageRef.current(text.trim()) }
    }
    r.onend = () => {}
    r.onerror = () => { setStatusText("Tap mic to speak") }
    try { r.start(); setOrbState("listening"); setStatusText("Listening…") }
    catch { setOrbState("listening"); setStatusText("Tap mic to speak") }
  }, [])

  // ── Audio queue ───────────────────────────────────────────────────────────────

  const playNextInQueue = useCallback(() => {
    if (ttsQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false
      if (streamDoneRef.current) { setOrbState("listening"); setStatusText("Listening…"); startListening() }
      return
    }
    isPlayingAudioRef.current = true
    setOrbState("speaking"); setStatusText("Speaking…")

    const item = ttsQueueRef.current.shift()!

    // Reveal this sentence on the board exactly when audio starts — text/voice sync
    revealedTextRef.current += (revealedTextRef.current ? " " : "") + item.displayText
    setRevealedText(revealedTextRef.current)

    item.audioPromise
      .then(audio => { audio.onended = () => playNextInQueue(); audio.onerror = () => playNextInQueue(); return audio.play() })
      .catch(() => playNextInQueue())
  }, [startListening])

  const enqueueSentence = useCallback((rawText: string) => {
    // Strip phase markers from display text, keep markdown
    const displayText = rawText.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
    if (!displayText) return

    if (mutedRef.current) {
      // No TTS but reveal text immediately so muted users still see content
      revealedTextRef.current += (revealedTextRef.current ? " " : "") + displayText
      setRevealedText(revealedTextRef.current)
      return
    }

    const ttsText = cleanForTTS(displayText)
    if (ttsText.trim().length < 4) return
    ttsQueueRef.current.push({ displayText, audioPromise: fetchTTSAudio(ttsText) })
    if (!isPlayingAudioRef.current) playNextInQueue()
  }, [fetchTTSAudio, playNextInQueue])

  // ── Send message ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    recognitionRef.current?.stop(); recognitionRef.current = null

    // Add user block to board
    setBoardBlocks(prev => [...prev, { id: `user-${Date.now()}`, type: "user", content: trimmed }])
    setShowInput(false); setInputText(""); setError(null)

    // Update messages for API
    messagesRef.current = [...messagesRef.current, { role: "user", content: trimmed }]

    setOrbState("thinking"); setStatusText("Thinking…")
    setIsStreaming(true)
    // Reset revealed text — new message starts blank, reveals word-by-word as TTS plays
    revealedTextRef.current = ""
    setRevealedText("")
    streamDoneRef.current = false; sentenceBufferRef.current = ""
    ttsQueueRef.current = []; isPlayingAudioRef.current = false

    // Determine streaming block type based on current phase
    const currentPhase = currentLessonPhaseRef.current
    if (currentPhase === "practice") {
      setStreamingBlockType("problem"); setStreamingDifficulty("practice")
      streamingBlockTypeRef.current = "problem"; streamingDifficultyRef.current = "practice"
    } else if (currentPhase === "challenge" && !challengeQuestionAskedRef.current) {
      setStreamingBlockType("problem"); setStreamingDifficulty("challenge")
      streamingBlockTypeRef.current = "problem"; streamingDifficultyRef.current = "challenge"
    } else {
      setStreamingBlockType("lecture"); setStreamingDifficulty(undefined)
      streamingBlockTypeRef.current = "lecture"; streamingDifficultyRef.current = undefined
    }

    const abort = new AbortController()
    abortControllerRef.current = abort
    let fullText = ""
    let xpFromEvent = 0
    let agentActivityFromEvent: AgentActivity[] | undefined

    try {
      const payload: TutorMessageRequest = {
        studentId,
        subject: realSubjectName,
        message: trimmed,
        voiceMode: true,
        mode,
        topic: topic || undefined,
        nodeId: nodeId || undefined,
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
            fullText += event.text as string
            // Don't set streamingContent here — text reveals sentence-by-sentence via TTS
            setOrbState("speaking"); setStatusText("Speaking…")
            sentenceBufferRef.current += event.text as string
            const { sentences, remainder } = extractSentences(sentenceBufferRef.current)
            sentenceBufferRef.current = remainder
            for (const s of sentences) enqueueSentence(s)
          } else if (event.type === "done") {
            xpFromEvent = Number(event.xpGained ?? 0)
            agentActivityFromEvent = event.agentActivity as AgentActivity[] | undefined
          }
        }
      }

      // Flush TTS buffer
      if (sentenceBufferRef.current.trim().length > 4) {
        enqueueSentence(sentenceBufferRef.current); sentenceBufferRef.current = ""
      }

      const { clean, phase: phaseMarker } = parsePhaseMarker(fullText)

      // Determine final block type
      const phase = currentLessonPhaseRef.current
      const { blockType, difficulty } = getBlockInfo(phaseMarker, phase, challengeQuestionAskedRef.current)

      // Track XP
      if (xpFromEvent > 0) {
        totalXpRef.current += xpFromEvent
        setTotalXp(totalXpRef.current)
      }

      // Build block
      const newBlock: BoardBlock = {
        id: `ai-${Date.now()}`,
        type: blockType === "debrief" ? "debrief" : blockType,
        content: clean,
        difficulty,
        xpGained: xpFromEvent > 0 ? xpFromEvent : undefined,
        xpTotal: blockType === "debrief" ? totalXpRef.current : undefined,
      }

      if (blockType === "problem" && phase === "challenge") {
        challengeQuestionAskedRef.current = true
      }

      // Check for phase transition
      const newPhase = detectPhaseTransition(phaseMarker)

      // Add AI block + optional phase divider
      setBoardBlocks(prev => {
        const blocks = [...prev, newBlock]
        if (newPhase) {
          blocks.push({ id: `divider-${Date.now()}`, type: "phase-divider", content: "", targetPhase: newPhase })
        }
        return blocks
      })

      // Update phase
      if (newPhase) {
        currentLessonPhaseRef.current = newPhase
        setCurrentLessonPhase(newPhase)
        if (newPhase === "challenge") challengeQuestionAskedRef.current = false
      }

      // Update session history
      messagesRef.current = [...messagesRef.current, { role: "assistant", content: clean }]

      // Handle lesson complete API call
      if ((phaseMarker === "complete" || phaseMarker === "challenge_passed") && nodeId && studentId) {
        void fetch(resolveUrl("/lesson/complete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, studentId, score: 8 }),
        })
      }

      // Show adaptation card if agent flagged a knowledge gap
      if (agentActivityFromEvent?.some(a => a.action.toLowerCase().includes("flag_knowledge_gap") || a.action.toLowerCase().includes("knowledge gap"))) {
        setBoardBlocks(prev => [...prev, {
          id: `adapt-${Date.now()}`,
          type: "adaptation",
          content: "",
          reason: "I noticed you're getting stuck on the same concept — adjusting my approach to explain it differently.",
        }])
      }

      setIsStreaming(false)
      streamDoneRef.current = true

      if (!isPlayingAudioRef.current && ttsQueueRef.current.length === 0) {
        setOrbState("listening"); setStatusText("Listening…"); startListening()
      }
    } catch (err) {
      const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"))
      if (fullText.trim()) {
        const clean = parsePhaseMarker(fullText).clean
        setBoardBlocks(prev => [...prev, { id: `ai-${Date.now()}`, type: "lecture", content: clean }])
      }
      setIsStreaming(false)
      if (!isAbort) { setError("Connection lost. Tap mic to try again."); setOrbState("idle"); setStatusText("") }
      else { setOrbState("idle"); setStatusText("Stopped — tap mic to continue") }
    }
  }, [studentId, realSubjectName, mode, topic, nodeId, resolveUrl, enqueueSentence, startListening])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Auto-start ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoSentRef.current) return
    autoSentRef.current = true

    // Add personalized greeting block immediately
    if (openingGreeting) {
      setBoardBlocks([{ id: "greeting", type: "greeting", content: openingGreeting }])
    }

    const msg = mode === "lesson" && topic
      ? `Start lesson on: ${topic}`
      : `__session_start__: Greet the student warmly, then ask them what specific topic or concept they want to work on today for ${realSubjectName}. Wait for their answer before teaching anything.`
    void sendMessage(msg)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => () => { abortControllerRef.current?.abort(); recognitionRef.current?.stop() }, [])

  // ── Interrupt / Stop ──────────────────────────────────────────────────────────

  // Interrupt during speaking → commit partial content + immediately start listening
  const handleInterrupt = useCallback(() => {
    // Stop TTS queue immediately
    ttsQueueRef.current = []
    isPlayingAudioRef.current = false
    streamDoneRef.current = false

    // Commit whatever was revealed so far as a proper board block
    const partial = revealedTextRef.current.trim()
    if (partial) {
      setBoardBlocks(prev => [...prev, {
        id: `ai-interrupted-${Date.now()}`,
        type: streamingBlockTypeRef.current,
        content: partial,
        difficulty: streamingDifficultyRef.current,
      }])
      revealedTextRef.current = ""
      setRevealedText("")
    }

    // Abort the stream if still generating
    abortControllerRef.current?.abort()
    setIsStreaming(false)

    // Jump straight to listening
    setOrbState("listening")
    setStatusText("Listening…")
    startListening()
  }, [startListening])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    ttsQueueRef.current = []; isPlayingAudioRef.current = false; streamDoneRef.current = false
    recognitionRef.current?.stop()
    setIsStreaming(false)
    revealedTextRef.current = ""; setRevealedText("")
    setOrbState("idle"); setStatusText("Stopped — tap mic to continue")
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const isBusy = orbState === "thinking" || orbState === "speaking" || isStreaming
  const phaseLabel: Record<LessonPhase, string> = {
    example: "Lecture",
    practice: "Practice",
    challenge: "Challenge",
    complete: "Complete",
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c1220] select-none">

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{realSubjectName}</p>
          {topic && <p className="text-white font-semibold text-[15px] mt-0.5 truncate max-w-[240px]">{topic}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Phase indicator */}
          {mode === "lesson" && (
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {phaseLabel[currentLessonPhase]}
            </span>
          )}
          {/* XP */}
          {totalXp > 0 && (
            <span className="text-[12px] font-bold text-amber-400">+{totalXp} XP</span>
          )}
          {/* Mute */}
          <button type="button" onClick={() => setMuted(m => !m)}
            className={`rounded-full w-9 h-9 flex items-center justify-center border transition-all ${muted ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"}`}>
            {muted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              </svg>
            )}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-[13px] text-slate-300 font-medium transition-colors">
            Exit
          </button>
        </div>
      </div>

      {/* Board */}
      <div ref={boardRef} className="flex-1 overflow-y-auto px-6 py-8" style={{ scrollBehavior: "smooth" }}>
        <div className="mx-auto max-w-2xl">

          {/* Empty / thinking state */}
          {boardBlocks.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <SmallOrb state="thinking" />
              <p className="text-slate-500 text-sm">Preparing your lesson…</p>
            </div>
          )}

          {/* Committed blocks */}
          {boardBlocks.map(block => <RenderBlock key={block.id} block={block} />)}

          {/* Streaming block — only shows text that has already been spoken */}
          {isStreaming && revealedText && (
            <RenderBlock
              block={{ id: "streaming", type: streamingBlockType, content: revealedText, difficulty: streamingDifficulty }}
              isStreaming
            />
          )}

          {/* Thinking / waiting for first word */}
          {isStreaming && !revealedText && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-widest">Tutor</span>
              </div>
              <div className="flex gap-1.5 items-center h-6">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-slate-600"
                    style={{ animation: `mic-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* Text input inline */}
          {showInput && (
            <div className="mt-4 rounded-2xl p-4"
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
                <button type="button" onClick={() => setShowInput(false)} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5">Cancel</button>
                <button type="button" onClick={() => { if (inputText.trim()) void sendMessage(inputText.trim()) }}
                  disabled={!inputText.trim()}
                  className="text-xs font-semibold rounded-lg px-4 py-1.5 disabled:opacity-30 transition-all"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                  Send
                </button>
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-6 pb-2">
          <p className="text-center text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex-shrink-0 px-6 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(12,18,32,0.95)" }}>
        <div className="flex items-center justify-between mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <SmallOrb state={orbState} />
            <span className="text-slate-400 text-sm min-w-0 truncate max-w-[160px]">{statusText}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Keyboard toggle */}
            <button type="button" onClick={() => setShowInput(v => !v)}
              className={`rounded-full w-11 h-11 flex items-center justify-center border transition-all ${showInput ? "bg-amber-400/15 border-amber-400/40 text-amber-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
              </svg>
            </button>

            {/* Small abort button when thinking (generating, no audio yet) */}
            {orbState === "thinking" && (
              <button type="button" onClick={handleStop}
                className="rounded-full w-11 h-11 flex items-center justify-center border bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 transition-all"
                title="Stop">
                <span className="block rounded-sm bg-slate-400" style={{ width: 14, height: 14 }} />
              </button>
            )}

            {/* Mic — always the primary action.
                During speaking  → interrupt (stops TTS, starts listening immediately)
                During listening → already active (pulsing green)
                Idle             → start listening */}
            <button
              type="button"
              onClick={() => {
                setError(null)
                if (orbState === "speaking") {
                  handleInterrupt()
                } else {
                  startListening()
                }
              }}
              className="rounded-full w-14 h-14 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all"
              style={{
                background:
                  orbState === "speaking"
                    ? "rgba(239,68,68,0.8)"      // red = interrupt
                    : orbState === "listening"
                    ? "rgba(74,222,128,0.85)"     // green = listening
                    : "rgba(251,191,36,0.85)",    // amber = idle / tap to speak
                boxShadow:
                  orbState === "speaking"
                    ? "0 0 24px rgba(239,68,68,0.35)"
                    : orbState === "listening"
                    ? "0 0 24px rgba(74,222,128,0.4)"
                    : "0 0 24px rgba(251,191,36,0.35)",
              }}
              title={orbState === "speaking" ? "Tap to interrupt" : "Speak"}
            >
              {orbState === "speaking" ? (
                // Hand-raise icon = interrupt
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#0c1220">
                  <path d="M18 11V7a2 2 0 0 0-4 0v4M14 7V4a2 2 0 0 0-4 0v7M10 9V6a2 2 0 0 0-4 0v8l-2-2a2 2 0 0 0-2.83 2.83L5 18a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-7a2 2 0 0 0-4 0z" stroke="#0c1220" strokeWidth="1.5" fill="none" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#0c1220">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h-3v2h8v-2h-3v-2.06A9 9 0 0 0 21 12v-2h-2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
