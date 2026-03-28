import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import type {
  AgentActivity,
  OnboardChatMessage,
  RoadmapNode,
  TutorMessageRequest,
  TutorMessageResponse,
} from "@shared/types"

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

export default function Tutor() {
  const { subject } = useParams<{ subject: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")
  const decodedSubject = useMemo(() => decodeURIComponent(subject ?? ""), [subject])
  const title = useMemo(() => decodedSubject || "general", [decodedSubject])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const topic = searchParams.get("topic") ?? ""
  const mode = searchParams.get("mode") ?? "sprint"

  const [messages, setMessages] = useState<OnboardChatMessage[]>([])
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalXp, setTotalXp] = useState(0)
  const [lastXp, setLastXp] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const autoSentRef = useRef(false)

  const resolveApiUrl = useCallback(
    (path: string) => {
      return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
    },
    [apiBase]
  )

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

      try {
        const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
        const realSubjectName =
          studyPath.find(
            (node) => node.subject.toLowerCase() === decodedSubject.toLowerCase()
          )?.subject ?? decodedSubject

        const payload: TutorMessageRequest = {
          studentId,
          subject: realSubjectName || decodedSubject,
          message: trimmed,
          voiceMode: false,
          sessionHistory: updatedMessages,
        }
        const response = await fetch(resolveApiUrl("/tutor/message"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("Failed to reach the tutor service.")
        const data = (await response.json()) as TutorMessageResponse
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
        if (data.agentActivity?.length) {
          setAgentActivity((prev) => [...prev, ...data.agentActivity])
        }
        if (typeof data.xpGained === "number") {
          setTotalXp((prev) => prev + data.xpGained)
          setLastXp(data.xpGained)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      } finally {
        setLoading(false)
      }
    },
    [apiBase, messages, studentId, subject, resolveApiUrl, decodedSubject]
  )

  const handleSubmit = () => {
    void sendMessage(input)
  }

  useEffect(() => {
    if (topic && messages.length === 0 && !autoSentRef.current) {
      autoSentRef.current = true
      void sendMessage(`Help me understand: ${topic}`)
    }
  }, [topic, messages.length, sendMessage])

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
      recognition.onend = () => {
        setListening(false)
      }
      recognition.onerror = () => {
        setListening(false)
      }
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

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground font-sans">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-sans font-bold">
              Tutor: {title}
            </h1>
            {totalXp > 0 && (
              <div className="rounded-full border border-[#E6D7C5] bg-white/80 px-4 py-1 text-sm text-foreground">
                Total XP: {totalXp}
              </div>
            )}
          </div>
          {topic && (
            <p className="mt-2 text-sm text-muted-foreground">
              Focus topic: {topic} • Mode: {mode}
            </p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-6 max-[900px]:grid-cols-1">
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 flex flex-col gap-4 min-h-[420px]">
            <div className="flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="rounded-xl border border-[#E6D7C5] bg-white/80 p-4 text-sm text-muted-foreground">
                  {topic
                    ? `Ready to dive into ${topic}. Ask a question to begin.`
                    : "Ask your tutor a question to begin."}
                </div>
              )}

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

            {error && <p className="text-sm text-[#B91C1C]">{error}</p>}
            {lastXp !== null && (
              <p className="text-sm text-[#B45309]">+{lastXp} XP earned</p>
            )}

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
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
                disabled={loading}
                className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors disabled:opacity-60"
              >
                Send
              </button>
            </div>

            {topic && messages.length === 0 && (
              <button
                type="button"
                onClick={() => void sendMessage(`Help me understand ${topic}.`)}
                className="self-start rounded-xl border border-[#FF8C00] px-4 py-2 text-sm font-semibold text-[#FF8C00] hover:bg-[#FFEC99]"
              >
                Start with {topic}
              </button>
            )}
          </section>

          <aside className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6">
            <h2 className="text-lg font-sans font-bold mb-4">Agent activity</h2>
            {agentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Agent updates will appear here once the tutor responds.
              </p>
            ) : (
              <ul className="space-y-3">
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
