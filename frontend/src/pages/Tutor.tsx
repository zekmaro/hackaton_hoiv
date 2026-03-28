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
import {
  buildClientTutorNote,
  buildDebriefCopy,
  buildTutorOpeningLine,
  getFeedbackLabel,
  getFeedbackVariant,
  getTaskIntro,
} from "../lib/tutor-ux"

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type LessonMode = "lecture" | "practice"
type PracticeState = "loading" | "question" | "submitted" | "complete"

type PracticeQuestion = {
  taskIndex: number
  type: "conceptual" | "application" | "debugging" | "explanation"
  question: string
  context?: string | null
  xpReward?: number
}

type PracticeAnswerResponse = {
  feedback: string
  isCorrect: boolean
  score?: number
  xpAwarded: number
  correctAnswer: string | null
  followUp: string | null
  isLastTask: boolean
  nextQuestion: PracticeQuestion | null
  totalXpEarned: number
}

type SubjectProfileResponse = {
  subject?: string
  weakTopics?: string[]
  lastSessionNote?: string
}

function parsePhaseMarker(text: string): { clean: string; phase: string | null } {
  const match = text.match(/\[PHASE:([a-z_]+)\]/)
  return {
    phase: match ? match[1] : null,
    clean: text.replace(/\[PHASE:[a-z_]+\]/g, "").trim(),
  }
}

function LessonDoc({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="lesson-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-4 leading-[1.8] text-[#5A3E36]">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[#3F2D24]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="bg-[#F0E3D1] text-[#5A3E36] px-1.5 py-0.5 rounded text-[0.88em] font-mono">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="bg-[#F8F7F4] border border-[#E6D7C5] rounded-xl p-5 overflow-x-auto text-sm font-mono my-5 text-[#5A3E36]">
              {children}
            </pre>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5 text-[#5A3E36]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-[#5A3E36]">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-6 text-[#3F2D24]">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="text-[18px] font-bold mb-3 mt-8 text-[#3F2D24]">
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-4 text-[#3F2D24]">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#FF8C00] pl-4 text-[#6C4F3D] my-4 italic bg-[#FFF4CC]/65 py-2 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-5">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#FFF4CC]">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-[#E6D7C5] px-4 py-2 text-left font-semibold text-xs uppercase tracking-wide text-[#6C4F3D]">{children}</th>
          ),
          td: ({ children }) => <td className="border border-[#E6D7C5] px-4 py-2 text-[#5A3E36]">{children}</td>,
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

const TYPE_LABELS: Record<PracticeQuestion["type"], string> = {
  conceptual: "CONCEPT",
  application: "APPLICATION",
  debugging: "DEBUG THIS",
  explanation: "EXPLAIN IT",
}

export default function Tutor() {
  const { subject } = useParams<{ subject: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")
  const studentName = localStorage.getItem("studentName") ?? "Student"

  const decodedSubject = useMemo(() => decodeURIComponent(subject ?? ""), [subject])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const topic = searchParams.get("topic") ?? ""
  const nodeId = searchParams.get("nodeId") ?? ""
  const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"
  const lessonMode = (searchParams.get("lessonMode") ?? "lecture") as LessonMode
  const isLesson = mode === "lesson"

  const studyPath = useMemo(
    () => JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[],
    []
  )
  const nodeFromStorage = useMemo(
    () => studyPath.find((item) => item.id === nodeId),
    [studyPath, nodeId]
  )

  const realSubjectName = useMemo(() => {
    return nodeFromStorage?.subject ?? decodedSubject
  }, [decodedSubject, nodeFromStorage])

  const lessonTitle = useMemo(() => {
    return nodeFromStorage?.topic ?? topic
  }, [nodeFromStorage, topic])
  const lectureOpeningLine = useMemo(
    () =>
      buildTutorOpeningLine({
        studentName,
        subject: realSubjectName,
        mode: "lecture",
        weakTopics: subjectWeakTopics,
        lastSessionNote,
      }),
    [lastSessionNote, realSubjectName, studentName, subjectWeakTopics]
  )
  const practiceOpeningLine = useMemo(
    () =>
      buildTutorOpeningLine({
        studentName,
        subject: realSubjectName,
        mode: "practice",
        weakTopics: subjectWeakTopics,
        lastSessionNote,
      }),
    [lastSessionNote, realSubjectName, studentName, subjectWeakTopics]
  )

  const resolveApiUrl = useCallback(
    (path: string) => (apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`),
    [apiBase]
  )

  useEffect(() => {
    if (!apiBase || !studentId || !realSubjectName) return
    void (async () => {
      try {
        const response = await fetch(
          resolveApiUrl(`/study-path/${studentId}/${encodeURIComponent(realSubjectName)}`)
        )
        if (!response.ok) return
        const data = (await response.json()) as SubjectProfileResponse
        if (Array.isArray(data.weakTopics)) {
          setSubjectWeakTopics(data.weakTopics.filter(Boolean))
        }
        if (typeof data.lastSessionNote === "string" && data.lastSessionNote.trim()) {
          setLastSessionNote(data.lastSessionNote.trim())
        }
      } catch {
        // Non-blocking optional context.
      }
    })()
  }, [apiBase, realSubjectName, resolveApiUrl, studentId])

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const freeChatAutoSentRef = useRef(false)
  const lectureAutoStartedRef = useRef(false)
  const practiceAutoStartedRef = useRef(false)

  const [voiceModeActive, setVoiceModeActive] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [messages, setMessages] = useState<OnboardChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [totalXp, setTotalXp] = useState(0)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const [lectureContent, setLectureContent] = useState("")
  const [isLectureStreaming, setIsLectureStreaming] = useState(false)
  const [isLectureLoaded, setIsLectureLoaded] = useState(false)
  const [lectureQuestion, setLectureQuestion] = useState("")
  const [lectureAnswer, setLectureAnswer] = useState("")
  const [lectureAnswerLoading, setLectureAnswerLoading] = useState(false)

  const [practiceSessionId, setPracticeSessionId] = useState("")
  const [practiceState, setPracticeState] = useState<PracticeState>("loading")
  const [practiceQuestion, setPracticeQuestion] = useState<PracticeQuestion | null>(null)
  const [taskIndex, setTaskIndex] = useState(0)
  const [totalTasks, setTotalTasks] = useState(4)
  const [practiceAnswer, setPracticeAnswer] = useState("")
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [isCorrect, setIsCorrect] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [totalPracticeXp, setTotalPracticeXp] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [practiceApiAvailable, setPracticeApiAvailable] = useState<boolean | null>(null)
  const [practiceScore, setPracticeScore] = useState<number | undefined>(undefined)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const [subjectWeakTopics, setSubjectWeakTopics] = useState<string[]>([])
  const [lastSessionNote, setLastSessionNote] = useState<string | null>(null)
  const [showDebrief, setShowDebrief] = useState(false)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsLectureStreaming(false)
    setStreamingContent(null)
    setLoading(false)
    setLectureAnswerLoading(false)
    setPracticeLoading(false)
  }, [])

  const streamTutorMessage = useCallback(
    async (payload: TutorMessageRequest): Promise<{ text: string; phase: string | null; xp: number }> => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch(resolveApiUrl("/tutor/message/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("Failed to reach tutor service.")
      if (!response.body) throw new Error("No stream body.")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""
      let finalPhase: string | null = null
      let xp = 0

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
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }
          if (event.type === "chunk") {
            fullText += String(event.text ?? "")
            setStreamingContent(parsePhaseMarker(fullText).clean)
          } else if (event.type === "done") {
            finalPhase = parsePhaseMarker(fullText).phase
            xp = Number(event.xpGained ?? 0)
            const activity = event.agentActivity as AgentActivity[] | undefined
            if (activity?.length) {
              setAgentActivity((prev) => [...prev, ...activity])
            }
          }
        }
      }

      const parsed = parsePhaseMarker(fullText)
      setStreamingContent(null)
      if (xp > 0) setTotalXp((prev) => prev + xp)
      return { text: parsed.clean, phase: finalPhase, xp }
    },
    [resolveApiUrl]
  )

  const startLecture = useCallback(async () => {
    if (!isLesson || lessonMode !== "lecture" || lectureAutoStartedRef.current) return
    lectureAutoStartedRef.current = true

    if (!studentId || !nodeId || !apiBase) {
      setError("Missing required lesson context.")
      return
    }

    setError(null)
    setIsLectureLoaded(false)
    setLectureContent("")
    setIsLectureStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch(resolveApiUrl("/lesson/lecture"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, studentId }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error("lecture-endpoint-unavailable")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setLectureContent(accumulated)
      }

      setLectureContent((prev) => prev.trim())
      setIsLectureLoaded(true)
    } catch (err) {
      const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"))
      if (isAbort) {
        setIsLectureLoaded(true)
        return
      }

      try {
        setLoading(true)
        setStreamingContent("")
        const fallback = await streamTutorMessage({
          studentId,
          subject: realSubjectName,
          message: `Start lecture on: ${lessonTitle}`,
          voiceMode: false,
          mode: "lesson",
          topic: lessonTitle,
          nodeId,
          sessionHistory: [],
        })
        setLectureContent(fallback.text)
        setIsLectureLoaded(true)
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : "Failed to generate lecture.")
      } finally {
        setLoading(false)
      }
    } finally {
      setIsLectureStreaming(false)
    }
  }, [apiBase, isLesson, lessonMode, lessonTitle, nodeId, realSubjectName, resolveApiUrl, streamTutorMessage, studentId])

  const askLectureQuestion = useCallback(async () => {
    if (!studentId || !lessonTitle || !realSubjectName || !lectureQuestion.trim()) return
    setLectureAnswerLoading(true)
    setError(null)
    try {
      setStreamingContent("")
      const result = await streamTutorMessage({
        studentId,
        subject: realSubjectName,
        message: lectureQuestion.trim(),
        voiceMode: false,
        mode: "lesson",
        topic: lessonTitle,
        nodeId: nodeId || undefined,
        sessionHistory: [],
      })
      setLectureAnswer(result.text)
      setLectureQuestion("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer the question.")
    } finally {
      setLectureAnswerLoading(false)
    }
  }, [lectureQuestion, lessonTitle, nodeId, realSubjectName, streamTutorMessage, studentId])

  const startPractice = useCallback(async () => {
    if (!isLesson || lessonMode !== "practice" || practiceAutoStartedRef.current) return
    practiceAutoStartedRef.current = true

    if (!studentId || !nodeId || !apiBase) {
      setError("Missing required lesson context.")
      setPracticeState("question")
      return
    }

    setError(null)
    setPracticeState("loading")

    try {
      const response = await fetch(resolveApiUrl("/lesson/practice/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, studentId }),
      })

      if (!response.ok) throw new Error("practice-endpoint-unavailable")

      const data = (await response.json()) as {
        sessionId: string
        totalTasks: number
        firstQuestion: PracticeQuestion
      }

      setPracticeApiAvailable(true)
      setPracticeSessionId(data.sessionId)
      setTotalTasks(data.totalTasks || 4)
      setTaskIndex(0)
      setPracticeQuestion(data.firstQuestion)
      setPracticeState("question")
    } catch {
      try {
        setPracticeApiAvailable(false)
        setStreamingContent("")
        const fallback = await streamTutorMessage({
          studentId,
          subject: realSubjectName,
          message: `Start practice on: ${lessonTitle}`,
          voiceMode: false,
          mode: "lesson",
          topic: lessonTitle,
          nodeId,
          sessionHistory: [],
        })
        setPracticeQuestion({
          taskIndex: 0,
          type: "conceptual",
          question: fallback.text,
          context: null,
          xpReward: 30,
        })
        setPracticeState("question")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start practice.")
        setPracticeState("question")
      }
    }
  }, [apiBase, isLesson, lessonMode, lessonTitle, nodeId, realSubjectName, resolveApiUrl, streamTutorMessage, studentId])

  const requestHint = useCallback(async () => {
    if (!studentId) return
    setHintLoading(true)
    setError(null)
    try {
      if (practiceApiAvailable && practiceSessionId) {
        const response = await fetch(resolveApiUrl("/lesson/practice/hint"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: practiceSessionId, studentId }),
        })
        if (!response.ok) throw new Error("Hint unavailable.")
        const data = (await response.json()) as { hint: string; xpCost?: number }
        setHint(data.hint)
        if (data.xpCost) setTotalXp((prev) => Math.max(0, prev - data.xpCost))
      } else {
        const response = await streamTutorMessage({
          studentId,
          subject: realSubjectName,
          message: `Give me one short hint for this question: ${practiceQuestion?.question ?? ""}`,
          voiceMode: false,
          mode: "lesson",
          topic: lessonTitle,
          nodeId: nodeId || undefined,
          sessionHistory: [],
        })
        setHint(response.text)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch hint.")
    } finally {
      setHintLoading(false)
    }
  }, [lessonTitle, nodeId, practiceApiAvailable, practiceQuestion?.question, practiceSessionId, realSubjectName, resolveApiUrl, streamTutorMessage, studentId])

  const submitPracticeAnswer = useCallback(async () => {
    if (!practiceAnswer.trim() || practiceLoading || !studentId) return
    setPracticeLoading(true)
    setError(null)
    try {
      if (practiceApiAvailable && practiceSessionId) {
        const response = await fetch(resolveApiUrl("/lesson/practice/answer"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: practiceSessionId, studentId, answer: practiceAnswer.trim() }),
        })
        if (!response.ok) throw new Error("Could not submit answer.")
        const data = (await response.json()) as PracticeAnswerResponse
        const currentScore = typeof data.score === "number" ? data.score : data.isCorrect ? 1 : 0
        const prefix = currentScore === 0 ? "Not quite - let me rephrase that for you. " : "Exactly right. Let me push you a bit further. "
        setFeedback(`${prefix}${data.feedback}`)
        setIsCorrect(data.isCorrect)
        setPracticeScore(currentScore)
        setXpAwarded(data.xpAwarded)
        setCorrectAnswer(data.correctAnswer)
        setFollowUp(data.followUp)
        setTotalPracticeXp(data.totalXpEarned)
        if (data.xpAwarded > 0) setTotalXp((prev) => prev + data.xpAwarded)
        if (data.isCorrect) setCorrectCount((prev) => prev + 1)
        if (currentScore === 0) {
          setConsecutiveWrong((prev) => prev + 1)
        } else {
          setConsecutiveWrong(0)
        }
        setPracticeQuestion((prev) => {
          if (!data.nextQuestion) return prev
          if (currentScore === 0 && consecutiveWrong + 1 >= 2) {
            return { ...data.nextQuestion, type: "conceptual" }
          }
          return data.nextQuestion
        })
        setPracticeState(data.isLastTask ? "complete" : "submitted")
      } else {
        const reply = await streamTutorMessage({
          studentId,
          subject: realSubjectName,
          message: `Evaluate my practice answer for "${lessonTitle}". Question: ${practiceQuestion?.question ?? ""}\nAnswer: ${practiceAnswer.trim()}`,
          voiceMode: false,
          mode: "lesson",
          topic: lessonTitle,
          nodeId: nodeId || undefined,
          sessionHistory: [],
        })
        const looksCorrect = /\b(correct|good|great|exactly|nice)\b/i.test(reply.text)
        const prefix = looksCorrect ? "Exactly right. Let me push you a bit further. " : "Not quite - let me rephrase that for you. "
        setFeedback(`${prefix}${reply.text}`)
        setIsCorrect(looksCorrect)
        setPracticeScore(looksCorrect ? 1 : 0)
        const awarded = looksCorrect ? 20 : 0
        setXpAwarded(awarded)
        setCorrectAnswer(null)
        setFollowUp(null)
        setTotalPracticeXp((prev) => prev + awarded)
        if (awarded > 0) {
          setCorrectCount((prev) => prev + 1)
          setTotalXp((prev) => prev + awarded)
          setConsecutiveWrong(0)
        } else {
          setConsecutiveWrong((prev) => prev + 1)
        }
        if (taskIndex >= totalTasks - 1) {
          setPracticeState("complete")
        } else {
          setPracticeState("submitted")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPracticeLoading(false)
      setHint(null)
    }
  }, [consecutiveWrong, lessonTitle, nodeId, practiceAnswer, practiceApiAvailable, practiceLoading, practiceQuestion?.question, practiceSessionId, realSubjectName, resolveApiUrl, streamTutorMessage, studentId, taskIndex, totalTasks])

  const goToNextPractice = useCallback(async () => {
    setPracticeAnswer("")
    setFeedback("")
    setCorrectAnswer(null)
    setFollowUp(null)
    setHint(null)
    setXpAwarded(0)
    setTaskIndex((prev) => prev + 1)

    if (practiceApiAvailable) {
      setPracticeState("question")
      return
    }

    if (!studentId) return
    setPracticeState("loading")
    try {
      setStreamingContent("")
      const next = await streamTutorMessage({
        studentId,
        subject: realSubjectName,
        message:
          consecutiveWrong >= 2
            ? `Give me a simpler conceptual practice question for ${lessonTitle} to rebuild fundamentals.`
            : `Give me the next practice question for ${lessonTitle}. Keep it focused and concise.`,
        voiceMode: false,
        mode: "lesson",
        topic: lessonTitle,
        nodeId: nodeId || undefined,
        sessionHistory: [],
      })
      setPracticeQuestion({
        taskIndex: taskIndex + 1,
        type: consecutiveWrong >= 2 ? "conceptual" : "application",
        question: next.text,
        context: null,
      })
      setPracticeState("question")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load next question.")
      setPracticeState("question")
    }
  }, [consecutiveWrong, lessonTitle, nodeId, practiceApiAvailable, realSubjectName, streamTutorMessage, studentId, taskIndex])

  const completeLesson = useCallback(async () => {
    if (!studentId || !nodeId || !apiBase) return
    try {
      await fetch(resolveApiUrl("/lesson/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, studentId, score: Math.min(10, Math.max(1, correctCount * 2)) }),
      })
    } catch {
      // Keep UI success regardless of completion endpoint response.
    }
  }, [apiBase, correctCount, nodeId, resolveApiUrl, studentId])

  const saveTutorNote = useCallback(() => {
    const notes = JSON.parse(localStorage.getItem("tutorNotesBySubject") ?? "{}") as Record<string, string>
    notes[realSubjectName.toLowerCase()] = buildClientTutorNote({
      subject: realSubjectName,
      correctCount,
      totalTasks,
    })
    localStorage.setItem("tutorNotesBySubject", JSON.stringify(notes))
  }, [correctCount, realSubjectName, totalTasks])

  const handleReturnToRoadmap = useCallback(() => {
    saveTutorNote()
    setShowDebrief(true)
    window.setTimeout(() => {
      navigate(`/dashboard/${encodeURIComponent(realSubjectName)}`)
    }, 2500)
  }, [navigate, realSubjectName, saveTutorNote])

  useEffect(() => {
    if (!isLesson || lessonMode !== "lecture") return
    void startLecture()
  }, [isLesson, lessonMode, startLecture])

  useEffect(() => {
    if (!isLesson || lessonMode !== "practice") return
    void startPractice()
  }, [isLesson, lessonMode, startPractice])

  useEffect(() => {
    if (isLesson || freeChatAutoSentRef.current || !topic || !studentId || !apiBase) return
    freeChatAutoSentRef.current = true
    void (async () => {
      setLoading(true)
      setStreamingContent("")
      try {
        const result = await streamTutorMessage({
          studentId,
          subject: realSubjectName,
          message: `Help me understand: ${topic}`,
          voiceMode: false,
          mode: "chat",
          topic,
          nodeId: nodeId || undefined,
          sessionHistory: [],
        })
        setMessages([{ role: "assistant", content: result.text }])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start chat.")
      } finally {
        setLoading(false)
      }
    })()
  }, [apiBase, isLesson, nodeId, realSubjectName, streamTutorMessage, studentId, topic])

  useEffect(() => {
    if (practiceState === "complete") {
      void completeLesson()
    }
  }, [completeLesson, practiceState])

  const toggleListening = () => {
    const Ctor = (
      window.SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined

    if (!Ctor) {
      setError("Speech recognition is not supported in this browser.")
      return
    }

    if (!recognitionRef.current) {
      const recognition = new Ctor()
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
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    setError(null)
    recognitionRef.current.start()
    setListening(true)
  }

  const sendChatMessage = useCallback(async () => {
    if (!input.trim() || !studentId) return
    const userMessage = input.trim()
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setInput("")
    setLoading(true)
    setError(null)
    try {
      setStreamingContent("")
      const result = await streamTutorMessage({
        studentId,
        subject: realSubjectName,
        message: userMessage,
        voiceMode: false,
        mode: "chat",
        topic: topic || undefined,
        nodeId: nodeId || undefined,
        sessionHistory: messages,
      })
      setMessages((prev) => [...prev, { role: "assistant", content: result.text }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
      setStreamingContent(null)
    }
  }, [input, messages, nodeId, realSubjectName, streamTutorMessage, studentId, topic])

  if (isLesson && lessonMode === "lecture") {
    const lectureSectionCount = (lectureContent.match(/^##\s+/gm) ?? []).length
    return (
      <>
        {voiceModeActive && (
          <VoiceMode
            onClose={() => setVoiceModeActive(false)}
            subject={decodedSubject}
            realSubjectName={realSubjectName}
            topic={lessonTitle}
            mode={mode}
            nodeId={nodeId}
            studentId={studentId ?? ""}
            apiBase={apiBase}
            initialMessages={lectureContent ? [{ role: "assistant", content: lectureContent }] : []}
          />
        )}
        <main className="min-h-screen bg-[#F5F0E8] font-sans text-[#5A3E36]">
          <div className="sticky top-0 z-20 bg-[#F5F0E8]/95 backdrop-blur border-b border-[#E8E0D4] px-8 h-[52px] flex items-center">
            <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate(`/lesson/${encodeURIComponent(nodeId)}`)}
                className="text-sm text-[#6C4F3D] hover:text-[#5A3E36]"
              >
                ← Back to lesson
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#FF8C00] text-white px-3 py-1 text-xs font-bold">Lecture</span>
                <span className="text-[#9CA3AF] text-xs">→</span>
                <span className="rounded-full bg-[#FFF4CC] text-[#9CA3AF] px-3 py-1 text-xs font-semibold">Practice</span>
              </div>
              <button
                type="button"
                onClick={() => setVoiceModeActive(true)}
                className="rounded-full bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e293b]"
              >
                Voice mode
              </button>
            </div>
          </div>

          <section className="mx-auto max-w-3xl px-6 py-10 pb-40">
            <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#9CA3AF] mb-2">Lecture</p>
            <h1 className="text-4xl font-extrabold leading-tight text-[#5A3E36] mb-7">{lessonTitle}</h1>

            <div className="tutor-bubble mb-6">
              <div className="tutor-bubble-header">
                <div className="tutor-identity">
                  <div className="tutor-avatar">🎓</div>
                  <span className="tutor-name">Your tutor</span>
                </div>
              </div>
              <p className="tutor-intro-text">"{lectureOpeningLine}"</p>
            </div>

            <LessonDoc content={lectureContent} isStreaming={isLectureStreaming} />

            {isLectureStreaming && lectureSectionCount >= 2 && (
              <div className="lecture-checkpoint">
                <p>Making sense so far? If anything is unclear, ask below before we continue.</p>
              </div>
            )}

            {isLectureStreaming && (
              <div className="mt-8 flex items-center gap-2 text-sm text-[#9CA3AF]">
                <span className="text-[#FF8C00] animate-pulse">✦</span>
                Writing lecture...
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          {isLectureStreaming && (
            <button
              type="button"
              onClick={stopStreaming}
              className="fixed bottom-20 right-8 z-30 w-11 h-11 rounded-full bg-[#111827] text-white shadow-lg flex items-center justify-center"
              title="Stop generating"
            >
              ■
            </button>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#F8F7F4]/95 backdrop-blur border-t border-[#E6D7C5] px-6 py-4">
            <div className="mx-auto max-w-3xl">
              {lectureAnswer && (
                <div className="mb-3 rounded-xl border border-[#E6D7C5] bg-white px-4 py-3 text-sm text-[#5A3E36]">
                  <div className="flex items-start justify-between gap-3">
                    <LessonDoc content={lectureAnswer} />
                    <button
                      type="button"
                      onClick={() => setLectureAnswer("")}
                      className="text-xs text-[#9CA3AF] hover:text-[#5A3E36]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  value={lectureQuestion}
                  onChange={(event) => setLectureQuestion(event.target.value)}
                  placeholder="Ask a question about the lecture..."
                  className="flex-1 h-11 rounded-xl border border-[#E6D7C5] bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/25"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void askLectureQuestion()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void askLectureQuestion()}
                  disabled={lectureAnswerLoading || !lectureQuestion.trim()}
                  className="h-11 px-5 rounded-xl border border-[#E6D7C5] bg-white text-[#6C4F3D] text-sm font-semibold disabled:opacity-60"
                >
                  {lectureAnswerLoading ? "Asking..." : "Ask"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/lesson/${encodeURIComponent(nodeId)}/practice`)}
                  disabled={!isLectureLoaded}
                  className="h-11 px-6 rounded-xl bg-[#FF8C00] text-white text-sm font-bold hover:bg-[#E67700] disabled:opacity-60"
                >
                  Practice problems →
                </button>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (isLesson && lessonMode === "practice") {
    const feedbackVariant = getFeedbackVariant(practiceScore, isCorrect)
    const feedbackLabel = getFeedbackLabel(feedbackVariant)
    const debrief = buildDebriefCopy({
      name: studentName,
      subject: realSubjectName,
      correctCount,
      totalTasks,
    })
    return (
      <main className="practice-page min-h-screen font-sans text-[#5A3E36]">
        <div className="sticky top-0 z-20 bg-[#F5F0E8]/95 backdrop-blur border-b border-[#E8E0D4] px-8 h-[52px] flex items-center">
          <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(`/lesson/${encodeURIComponent(nodeId)}`)}
              className="text-sm text-[#6C4F3D] hover:text-[#5A3E36]"
            >
              ← Back to lesson
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#FEF3C7] text-[#92400E] px-3.5 py-1 text-[13px] font-semibold">Lecture</span>
              <span className="text-[#9CA3AF] text-xs">→</span>
              <span className="rounded-full bg-[#E67E00] text-white px-3.5 py-1 text-[13px] font-bold">Practice</span>
            </div>
            <span className="text-sm text-[#9C8A72] font-medium">
              {Math.min(taskIndex + 1, totalTasks)} / {totalTasks}
            </span>
          </div>
        </div>

        <section className="practice-content">
          <p className="practice-label">Practice</p>
          <h1 className="practice-title">{lessonTitle}</h1>

          <div className="task-progress">
            {Array.from({ length: totalTasks }).map((_, index) => {
              const isDone = index < taskIndex
              const isActive = index === taskIndex && practiceState !== "complete"
              const cls = isDone ? "task-dot--done" : isActive ? "task-dot--active" : "task-dot--upcoming"
              return <span key={index} className={`task-dot ${cls}`} />
            })}
            <span className="task-progress-label">
              Task {Math.min(taskIndex + 1, totalTasks)} of {totalTasks}
            </span>
          </div>

          {practiceState === "loading" && (
            <div className="tutor-bubble" style={{ minHeight: 120 }}>
              <div className="tutor-bubble-header">
                <div className="tutor-identity">
                  <div className="tutor-avatar">🎓</div>
                  <span className="tutor-name">Your tutor</span>
                </div>
              </div>
              <p className="tutor-intro-text" style={{ fontStyle: "normal" }}>
                <span className="streaming-dot">✦</span> Setting up your session...
              </p>
            </div>
          )}

          {(practiceState === "question" || practiceState === "submitted") && practiceQuestion && (
            <div className="space-y-4">
              <div className="tutor-bubble">
                <div className="tutor-bubble-header">
                  <div className="tutor-identity">
                    <div className="tutor-avatar">🎓</div>
                    <span className="tutor-name">Your tutor</span>
                  </div>
                  <span className="task-type-badge">{TYPE_LABELS[practiceQuestion.type]}</span>
                </div>
                <p className="tutor-intro-text">
                  "{taskIndex === 0 ? practiceOpeningLine : getTaskIntro(practiceQuestion.type)}"
                </p>
                <div className="question-card">
                  <p className="question-text">{practiceQuestion.question}</p>
                  {practiceQuestion.context && (
                    <div className="question-context">
                      <span className="question-context-label">Reference</span>
                      <pre><code>{practiceQuestion.context}</code></pre>
                    </div>
                  )}
                </div>
              </div>

              {practiceState === "question" && (
                <div className="answer-area">
                  <span className="answer-label">Your answer</span>
                  <textarea
                    rows={4}
                    value={practiceAnswer}
                    onChange={(event) => setPracticeAnswer(event.target.value)}
                    placeholder="Type your answer here... (Ctrl + Enter to submit)"
                    className="answer-textarea"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && event.ctrlKey) {
                        event.preventDefault()
                        void submitPracticeAnswer()
                      }
                    }}
                  />
                  {hint && (
                    <div className="hint-reveal">
                      <div className="hint-badge">💡 Hint</div>
                      <p>{hint}</p>
                    </div>
                  )}
                  <div className="answer-actions">
                    <button
                      type="button"
                      onClick={() => void requestHint()}
                      disabled={hintLoading || Boolean(hint)}
                      className="hint-trigger"
                    >
                      💡 {hintLoading ? "..." : hint ? "Hint shown" : "Hint -10 XP"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitPracticeAnswer()}
                      disabled={!practiceAnswer.trim() || practiceLoading}
                      className="submit-answer-btn"
                    >
                      {practiceLoading ? "Checking..." : "Submit →"}
                    </button>
                  </div>
                </div>
              )}

              {practiceState === "submitted" && (
                <div className={`feedback-bubble feedback-bubble--${feedbackVariant}`}>
                  <div className="tutor-bubble-header">
                    <div className="tutor-identity">
                      <div className="tutor-avatar">🎓</div>
                      <span className="tutor-name">Your tutor</span>
                    </div>
                  </div>
                  <div className="feedback-result-row">
                    <div className="feedback-result-icon">{feedbackVariant === "correct" ? "✓" : feedbackVariant === "partial" ? "~" : "✗"}</div>
                    <span className="feedback-result-label">{feedbackLabel}</span>
                    {xpAwarded > 0 && <span className="feedback-xp-pill">+{xpAwarded} XP</span>}
                  </div>
                  <p className="feedback-text">
                    {feedback}
                    {consecutiveWrong >= 2 && feedbackVariant === "wrong"
                      ? " Let me try a simpler angle on this."
                      : ""}
                  </p>
                  {correctAnswer && (
                    <div className="model-answer-block">
                      <p className="model-answer-label">Model answer</p>
                      <p className="model-answer-text">{correctAnswer}</p>
                    </div>
                  )}
                  {followUp && (
                    <div className="followup-block">
                      <p className="followup-label">Bonus question</p>
                      <p className="followup-text">{followUp}</p>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void goToNextPractice()}
                      className="next-question-btn"
                    >
                      {taskIndex >= totalTasks - 1 ? "See your results →" : "Next question →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {practiceState === "complete" && (
            <div className="results-wrapper">
              <div className="tutor-bubble mb-6">
                <div className="tutor-bubble-header">
                  <div className="tutor-identity">
                    <div className="tutor-avatar">🎓</div>
                    <span className="tutor-name">Your tutor</span>
                  </div>
                </div>
                <p className="tutor-intro-text" style={{ fontStyle: "normal" }}>
                  "{debrief.subline}"
                </p>
              </div>
              <div className="results-score-card">
                <div className="results-score-display">
                  <span className="results-score-number">{correctCount}</span>
                  <span className="results-score-total">/ {totalTasks}</span>
                </div>
                <div
                  className="results-grade-badge"
                  data-grade={
                    correctCount === totalTasks
                      ? "perfect"
                      : correctCount / totalTasks >= 0.75
                        ? "strong"
                        : correctCount / totalTasks >= 0.5
                          ? "decent"
                          : "needs-work"
                  }
                >
                  {correctCount === totalTasks
                    ? "Perfect"
                    : correctCount / totalTasks >= 0.75
                      ? "Strong"
                      : correctCount / totalTasks >= 0.5
                        ? "Decent"
                        : "Needs work"}
                </div>
                <div className="results-xp-row">
                  <span>⭐</span>
                  <span className="results-xp-text">+{totalPracticeXp} XP earned this session</span>
                </div>
              </div>
              {correctCount / totalTasks < 0.75 && (
                <div className="results-suggestion">
                  <div className="suggestion-label">Suggested next step</div>
                  <p>Review the lecture, focusing on the worked example. Then come back and retry.</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleReturnToRoadmap}
                className="return-btn"
              >
                Back to roadmap
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>
        {showDebrief && (
          <div className="debrief-overlay">
            <div className="debrief-card">
              <p className="debrief-line">"{debrief.line}"</p>
              <p className="debrief-subline">{debrief.subline}</p>
              <div className="debrief-xp">+{totalPracticeXp} XP</div>
            </div>
          </div>
        )}
      </main>
    )
  }

  const displayMessages = streamingContent
    ? [...messages, { role: "assistant" as const, content: streamingContent }]
    : messages

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
                  Voice mode
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/60 p-6 flex flex-col gap-4 min-h-[500px]">
            <div className="flex-1 space-y-5 overflow-y-auto max-h-[600px] pr-1">
              {displayMessages.length === 0 && !loading && !streamingContent && (
                <p className="text-sm text-muted-foreground p-2">Ask anything — this is office hours.</p>
              )}

              {displayMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" ? (
                    <div className="w-full bg-white rounded-2xl border border-[#E6D7C5] px-5 py-4 text-sm shadow-sm">
                      <LessonDoc content={msg.content} isStreaming={Boolean(streamingContent && index === displayMessages.length - 1)} />
                    </div>
                  ) : (
                    <div className="max-w-[70%] rounded-2xl bg-[#0F172A] px-4 py-3 text-sm text-white leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {loading && !streamingContent && (
                <div className="flex gap-1 px-2 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {error && <p className="text-sm text-[#B91C1C]">{error}</p>}

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask your tutor anything..."
                disabled={Boolean(streamingContent)}
                className="flex-1 rounded-xl border border-[#E6D7C5] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/30 disabled:opacity-50"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendChatMessage()
                  }
                }}
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={Boolean(streamingContent)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  listening ? "border-[#FF8C00] text-[#FF8C00] bg-[#FEF3C7]" : "border-[#E6D7C5] text-muted-foreground bg-white hover:border-[#FF8C00]"
                }`}
              >
                {listening ? "●" : "Mic"}
              </button>
              {streamingContent ? (
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
                  onClick={() => void sendChatMessage()}
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
