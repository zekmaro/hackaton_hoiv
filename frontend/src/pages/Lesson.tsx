import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { RoadmapNode } from "@shared/types"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

type LessonPhase = "intro" | "keypoints" | "quiz" | "summary"

type LessonContent = {
  intro: string
  keyPoints: { title: string; explanation: string; example?: string }[]
  quiz: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
  summary: string
  xpReward: number
}

type LessonResponse = {
  lesson: LessonContent
  node: RoadmapNode & {
    title?: string
    description?: string
    topic?: string
  }
}

export default function Lesson() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const decodedNodeId = useMemo(() => decodeURIComponent(nodeId ?? ""), [nodeId])
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")

  const [lesson, setLesson] = useState<LessonContent | null>(null)
  const [node, setNode] = useState<LessonResponse["node"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<LessonPhase>("intro")

  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [quizDone, setQuizDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [xpGained, setXpGained] = useState(0)

  const resolveApiUrl = useCallback(
    (path: string) => {
      return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
    },
    [apiBase]
  )

  const phaseIndex = useMemo(() => {
    const order: LessonPhase[] = ["intro", "keypoints", "quiz", "summary"]
    return order.indexOf(phase)
  }, [phase])

  useEffect(() => {
    if (!studentId) {
      navigate("/onboarding")
      return
    }
    if (!apiBase || !decodedNodeId) {
      setError("Missing lesson information.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    fetch(resolveApiUrl("/lesson/content"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: decodedNodeId, studentId }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load lesson content.")
        return response.json()
      })
      .then((data: LessonResponse) => {
        setLesson(data.lesson)
        setNode(data.node)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.")
        setLoading(false)
      })
  }, [apiBase, decodedNodeId, navigate, resolveApiUrl, studentId])

  const handleQuizAnswer = (index: number) => {
    if (!lesson || answered) return
    setSelected(index)
    setAnswered(true)
    if (index === lesson.quiz[currentQ].correctIndex) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNextQuestion = () => {
    if (!lesson) return
    if (currentQ < lesson.quiz.length - 1) {
      setCurrentQ((prev) => prev + 1)
      setSelected(null)
      setAnswered(false)
    } else {
      setQuizDone(true)
    }
  }

  const handleComplete = async () => {
    if (!apiBase || !studentId || !decodedNodeId) return
    setCompleting(true)
    try {
      const response = await fetch(resolveApiUrl("/lesson/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: decodedNodeId, studentId, score }),
      })
      if (!response.ok) throw new Error("Failed to save lesson completion.")
      const data = await response.json()
      setXpGained(data.xpGained ?? 0)
      setPhase("summary")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <main className="lesson-page px-6 py-12 text-foreground font-sans">
        <div className="mx-auto max-w-3xl">Loading lesson...</div>
      </main>
    )
  }

  if (!lesson || !node) {
    return (
      <main className="lesson-page px-6 py-12 text-foreground font-sans">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">{error ?? "Lesson not found."}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-xl bg-[#FF8C00] px-4 py-2 text-sm font-semibold text-white"
          >
            Go back
          </button>
        </div>
      </main>
    )
  }

  const Markdown = ({ content, className }: { content: string; className?: string }) => (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  )

  return (
    <main className="lesson-page text-foreground font-sans">
      <header className="lesson-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="lesson-back"
        >
          ← {node.subject}
        </button>
        <div className="lesson-dots">
          {["intro", "keypoints", "quiz", "summary"].map((step, index) => {
            const active = index === phaseIndex
            const past = index < phaseIndex
            return (
              <span
                key={step}
                className={`lesson-dot ${active ? "active" : ""} ${past ? "past" : ""}`}
              />
            )
          })}
        </div>
        <div className="lesson-title">
          {node.topic} — {node.title ?? node.topic}
        </div>
      </header>

      <section className="lesson-content">
        {phase === "intro" && (
          <div className="lesson-phase">
            <p className="lesson-tag">
              {node.subject} — {node.topic}
            </p>
            <h1 className="lesson-heading">{node.title ?? node.topic}</h1>
            <div className="lesson-card">
              <Markdown content={lesson.intro} className="lesson-body markdown-content" />
            </div>
            <button
              type="button"
              onClick={() => setPhase("keypoints")}
              className="lesson-primary-btn"
            >
              Start learning →
            </button>
          </div>
        )}

        {phase === "keypoints" && (
          <div className="lesson-phase">
            <h2 className="lesson-section-title">Key concepts</h2>
            <p className="lesson-section-subtitle">3 things to understand before the quiz</p>
            <div className="lesson-keypoints">
              {lesson.keyPoints.map((point, index) => (
                  <div key={point.title + index} className="lesson-card">
                    <div className="lesson-badge">{index + 1}</div>
                    <h3 className="lesson-card-title">{point.title}</h3>
                    <Markdown content={point.explanation} className="lesson-body markdown-content" />
                    {point.example && (
                      <div className="lesson-example">
                        <p className="lesson-example-label">Example</p>
                        <Markdown
                          content={point.example}
                          className="lesson-example-text markdown-content"
                        />
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("quiz")}
              className="lesson-primary-btn"
            >
              Take the quiz →
            </button>
          </div>
        )}

        {phase === "quiz" && lesson.quiz.length > 0 && !quizDone && (
          <div className="lesson-phase">
            <div className="lesson-quiz-header">
              <span>Question {currentQ + 1} of {lesson.quiz.length}</span>
              <span className="lesson-quiz-score">{score} correct</span>
            </div>
            <div className="lesson-card">
              <Markdown
                content={lesson.quiz[currentQ].question}
                className="lesson-quiz-question markdown-content"
              />
            </div>
            <div className="lesson-options">
              {lesson.quiz[currentQ].options.map((option, index) => {
                const correct = index === lesson.quiz[currentQ].correctIndex
                const isSelected = selected === index
                const stateClass = answered
                  ? correct
                    ? "correct"
                    : isSelected
                      ? "wrong"
                      : "neutral"
                  : ""
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleQuizAnswer(index)}
                    className={`lesson-option ${stateClass}`}
                    disabled={answered}
                  >
                    <span className="lesson-option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <Markdown content={option} className="lesson-option-text markdown-content" />
                  </button>
                )
              })}
            </div>
            {answered && (
              <Markdown
                content={lesson.quiz[currentQ].explanation}
                className="lesson-explanation markdown-content"
              />
            )}
            {answered && (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="lesson-primary-btn"
              >
                {currentQ < lesson.quiz.length - 1 ? "Next question →" : "See results →"}
              </button>
            )}
          </div>
        )}

        {phase === "quiz" && quizDone && (
          <div className="lesson-phase lesson-results">
            <div className="lesson-score">{score}/{lesson.quiz.length}</div>
            <p className="lesson-score-label">
              {score === lesson.quiz.length
                ? "Perfect score! 🎉"
                : score === lesson.quiz.length - 1
                  ? "Great job! 👍"
                  : score === 0
                    ? "Don't worry — let's go over it"
                    : "Good effort — review the key points"}
            </p>
            <p className="lesson-xp-preview">You'll earn {50 + score * 15} XP</p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="lesson-primary-btn lesson-primary-btn--full"
            >
              {completing ? "Saving..." : "Complete lesson →"}
            </button>
          </div>
        )}

        {phase === "summary" && (
          <div className="lesson-phase lesson-summary">
            <div className="lesson-xp-earned">+{xpGained} XP earned!</div>
            <div className="lesson-card">
              <p className="lesson-tag">What you learned</p>
              <Markdown content={lesson.summary} className="lesson-body markdown-content" />
            </div>
            <button
              type="button"
              onClick={() => navigate(`/dashboard/${encodeURIComponent(node.subject.toLowerCase())}`)}
              className="lesson-primary-btn"
            >
              Back to roadmap →
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
