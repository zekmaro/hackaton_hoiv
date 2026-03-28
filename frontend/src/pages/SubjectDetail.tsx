import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { SUBJECT_COLORS, SUBJECT_ICONS } from "../lib/subject-colors"
import type { RoadmapNode } from "@shared/types"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

type RoadmapStatusLabel = "In progress" | "Up next" | "Locked" | "Completed"

type RoadmapNodeWithLesson = RoadmapNode & {
  title?: string
  description?: string
  weekNumber?: number
  orderInWeek?: number
  difficulty?: "foundation" | "core" | "advanced"
}

const getStatusLabel = (status: string): RoadmapStatusLabel => {
  if (status === "in_progress") return "In progress"
  if (status === "available" || status === "up_next") return "Up next"
  if (status === "completed") return "Completed"
  return "Locked"
}

type SubjectDetailResponse = {
  subject: string
  nodes: RoadmapNodeWithLesson[]
  byWeek?: Record<string, RoadmapNodeWithLesson[]>
  currentWeek?: number
  totalWeeks?: number
  xp?: number
  streak?: number
  name?: string
  examDate?: string | null
  badges?: { id: string; name: string; icon: string }[]
  studyHoursPerDay?: number
}

type StudyPathResponse = {
  studentId: string
  studyPath: RoadmapNodeWithLesson[]
  xp: number
  level: number
  streak: number
  nextExam: { subject: string; date: string; daysLeft: number } | null
  todaysFocus: { subject: string; topic: string; reason: string }
  badges?: { id: string; name: string; icon: string }[]
}

const statusStyles: Record<RoadmapStatusLabel, string> = {
  "In progress": "bg-[rgba(230,126,0,0.12)] border-[rgba(230,126,0,0.3)] text-[#B45309]",
  "Up next": "bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.3)] text-[#1D4ED8]",
  Locked: "bg-[rgba(0,0,0,0.05)] border-[rgba(0,0,0,0.1)] text-[#6B5B00]",
  Completed: "bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.3)] text-[#15803D]",
}

export default function SubjectDetail() {
  const { subject } = useParams<{ subject: string }>()
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")
  const decodedSubject = useMemo(() => decodeURIComponent(subject ?? ""), [subject])
  const subjectKey = decodedSubject.toLowerCase()
  const [subjectName, setSubjectName] = useState(() =>
    decodedSubject ? decodedSubject.charAt(0).toUpperCase() + decodedSubject.slice(1) : "Math"
  )

  const accent = SUBJECT_COLORS[subjectKey] ?? SUBJECT_COLORS.default
  const icon = SUBJECT_ICONS[subjectKey] ?? SUBJECT_ICONS.default

  const [roadmap, setRoadmap] = useState<RoadmapNodeWithLesson[]>([])
  const [studyMeta, setStudyMeta] = useState<SubjectDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resolveApiUrl = useCallback(
    (path: string) => {
      return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
    },
    [apiBase]
  )

  const normalizeSubject = useCallback(
    (value: string) => value.toLowerCase().replace(/\s+/g, "-"),
    []
  )

  const loadStudyPath = useCallback(async () => {
    if (!apiBase || !studentId) {
      setError("Study path data is not available yet.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const subjectResponse = await fetch(
        resolveApiUrl(`/study-path/${studentId}/${encodeURIComponent(decodedSubject)}`)
      )
      if (subjectResponse.ok) {
        const data = (await subjectResponse.json()) as SubjectDetailResponse
        if (Array.isArray(data.nodes)) {
          setRoadmap(data.nodes)
          const existing = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
          const merged = [
            ...existing.filter((node) => node.subject.toLowerCase() !== data.subject.toLowerCase()),
            ...data.nodes,
          ]
          localStorage.setItem("studyPath", JSON.stringify(merged))
        }
        setStudyMeta(data)
        if (data.subject) {
          setSubjectName(data.subject)
        }
        return
      }

      const response = await fetch(resolveApiUrl(`/study-path/${studentId}`))
      if (!response.ok) throw new Error("Failed to load your study path.")
      const data = (await response.json()) as StudyPathResponse
      if (Array.isArray(data.studyPath)) {
        setRoadmap(data.studyPath)
        localStorage.setItem("studyPath", JSON.stringify(data.studyPath))
      }
      setStudyMeta({
        subject: subjectName,
        nodes: data.studyPath.filter(
          (node) => normalizeSubject(node.subject) === normalizeSubject(subjectKey)
        ),
        xp: data.xp,
        streak: data.streak,
        badges: data.badges ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [apiBase, studentId, resolveApiUrl, decodedSubject, normalizeSubject, subjectKey, subjectName])

  useEffect(() => {
    void loadStudyPath()
  }, [loadStudyPath])

  useEffect(() => {
    if (decodedSubject) {
      setSubjectName(decodedSubject.charAt(0).toUpperCase() + decodedSubject.slice(1))
    }
  }, [decodedSubject])

  const subjectNodes = useMemo(
    () =>
      roadmap.filter(
        (node) =>
          normalizeSubject(node.subject) === normalizeSubject(subjectKey)
      ),
    [roadmap, subjectKey, normalizeSubject]
  )

  const nodesByWeek = useMemo(() => {
    if (studyMeta?.byWeek) {
      const entries = Object.entries(studyMeta.byWeek)
      return entries
        .map(([week, nodes]) => [Number(week), nodes] as [number, RoadmapNodeWithLesson[]])
        .sort(([a], [b]) => a - b)
    }
    const map = new Map<number, RoadmapNodeWithLesson[]>()
    subjectNodes.forEach((node) => {
      const week = node.weekNumber ?? 1
      const list = map.get(week)
      if (list) {
        list.push(node)
      } else {
        map.set(week, [node])
      }
    })
    map.forEach((nodes) => {
      nodes.sort((a, b) => (a.orderInWeek ?? 0) - (b.orderInWeek ?? 0))
    })
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [subjectNodes, studyMeta])

  const totalCount = subjectNodes.length
  const focusNodes = subjectNodes.filter(
    (node) =>
      node.status === "available" || node.status === "up_next" || node.status === "in_progress"
  )
  const nextNode =
    subjectNodes.find((node) => node.status === "in_progress") ??
    subjectNodes.find((node) => node.status === "available" || node.status === "up_next")
  const currentWeek =
    studyMeta?.currentWeek ??
    nextNode?.weekNumber ??
    subjectNodes.find((node) => node.status === "in_progress")?.weekNumber ??
    subjectNodes[0]?.weekNumber ??
    1
  const totalWeeks =
    studyMeta?.totalWeeks ??
    (subjectNodes.length > 0
      ? Math.max(...subjectNodes.map((node) => node.weekNumber ?? 1))
      : 1)

  const tutorReturnLine = useMemo(() => {
    const name = studyMeta?.name ?? "there"
    const examDate = studyMeta?.examDate
    if (examDate) {
      const examMs = new Date(examDate).getTime()
      if (!Number.isNaN(examMs)) {
        const daysLeft = Math.max(0, Math.ceil((examMs - Date.now()) / 86400000))
        return `Welcome back, ${name}. ${daysLeft} day${daysLeft === 1 ? "" : "s"} to your exam. Here's where to focus.`
      }
    }
    return `Welcome back, ${name}. Here's where to focus next.`
  }, [studyMeta?.examDate, studyMeta?.name])

  const Markdown = ({ content, className }: { content: string; className?: string }) => (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  )

  if (loading) {
    return <main className="min-h-screen bg-background" />
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-8 md:px-12 py-12 font-sans">
      <div className="mb-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
          >
            ← Back to subjects
          </button>
          <h1 className="mt-3 text-[48px] leading-[1.1] font-sans font-extrabold">
            {studyMeta?.name ? `Welcome back, ${studyMeta.name}` : "Welcome back"}
          </h1>
          <p className="mt-2 text-[16px] text-muted-foreground">{tutorReturnLine}</p>
        </div>
        {studyMeta?.streak !== undefined && (
          <div className="h-9 px-4 rounded-full bg-white/80 border border-[#E6D7C5] flex items-center gap-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
            <span className="text-[14px] text-foreground">Streak: {studyMeta.streak} days</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6 items-start max-[900px]:grid-cols-1">
        {(nextNode || focusNodes.length > 0 || studyMeta?.badges?.length) && (
          <aside className="today-panel rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-4">
              Today
            </p>
            {nextNode && (
              <>
                <div className="mb-5">
                  <h2 className="text-[38px] leading-[1.05] font-sans font-extrabold text-foreground">
                    {subjectName}
                  </h2>
                  <div className="mt-3 rounded-xl border border-[#E6D7C5] bg-white/70 px-3 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.07em] uppercase text-muted-foreground mb-1">
                      Next topic
                    </p>
                    <p className="text-[16px] leading-6 font-sans font-semibold text-foreground">
                      {nextNode.topic}
                    </p>
                  </div>
                </div>
                <div className="mb-6 flex items-center gap-2 text-[14px] text-muted-foreground">
                  <span className="text-lg" style={{ color: accent }}>
                    {icon}
                  </span>
                  <span>
                    {focusNodes.length} focus {focusNodes.length === 1 ? "block" : "blocks"}
                  </span>
                </div>
              </>
            )}

            {studyMeta?.xp !== undefined && (
              <>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
                  XP
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {studyMeta.xp} XP
                </p>
              </>
            )}

            {studyMeta?.badges?.length ? (
              <>
                <p className="mt-5 text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
                  Badges
                </p>
                <div className="flex flex-wrap gap-2">
                  {studyMeta.badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="h-7 px-3 rounded-full border border-[#E6D7C5] bg-white/80 text-[13px] text-foreground flex items-center"
                    >
                      {badge.icon} {badge.name}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </aside>
        )}

        <div className="roadmap-panel">
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[20px] font-sans font-bold text-foreground">
                Your roadmap
              </h2>
              {totalCount > 0 && (
                <span className="text-[14px] text-muted-foreground">
                  Week {currentWeek} of {totalWeeks}
                </span>
              )}
            </div>

            {!loading && error && (
              <div className="rounded-xl border border-[#E6D7C5] bg-white/70 p-4 text-sm text-muted-foreground">
                {error}
              </div>
            )}

            {!loading && !error && subjectNodes.length === 0 && (
              <div className="rounded-xl border border-[#E6D7C5] bg-white/70 p-4 text-sm text-muted-foreground">
                No roadmap nodes found for this subject yet.
              </div>
            )}

            {!loading && !error && subjectNodes.length > 0 && (
              <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-2">
                {(nodesByWeek.find(([week]) => week === currentWeek)?.[1] ?? subjectNodes).map(
                  (node) => {
                  const statusLabel = getStatusLabel(node.status)
                  const locked = node.status === "locked"
                  const onClick = () => {
                    if (locked) return
                    navigate(`/lesson/${encodeURIComponent(node.id)}`)
                  }

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={onClick}
                      title={locked ? "Complete previous nodes first" : ""}
                      className={`roadmap-node roadmap-node--${node.status} ${locked ? "roadmap-node--locked" : ""} text-left rounded-xl border border-[#E6D7C5] bg-white/80 p-4`}
                    >
                      <p className="text-[11px] font-semibold tracking-[0.07em] uppercase text-muted-foreground mb-2">
                        {node.subject} — {node.topic}
                      </p>
                      <h3 className="text-[18px] font-sans font-bold text-foreground mb-3">
                        {node.title ?? node.topic}
                      </h3>
                      {node.description && (
                        <Markdown
                          content={node.description}
                          className="text-[13px] text-muted-foreground mb-3 markdown-content"
                        />
                      )}
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-3 text-[12px] font-medium ${
                          statusStyles[statusLabel]
                        }`}
                      >
                        {statusLabel}
                      </span>
                      {!locked && (
                        <span className="node-hover-label">Start lesson →</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {nextNode && (
            <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 flex items-center justify-between gap-4 max-[600px]:flex-col max-[600px]:items-start">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
                  Next session
                </p>
                <p className="text-[24px] font-sans font-bold text-foreground mb-1">
                  {nextNode.topic}
                </p>
                <p className="text-[14px] text-muted-foreground">Starts when you are ready</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/lesson/${encodeURIComponent(nextNode.id)}`)}
                className="h-12 px-7 rounded-[10px] bg-[#FF8C00] text-white text-[15px] font-sans font-bold hover:bg-[#e07b00] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(255,140,0,0.35)] transition-all"
              >
                Start now
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
