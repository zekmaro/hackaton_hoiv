import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { SUBJECT_COLORS, SUBJECT_ICONS } from "../lib/subject-colors"
import type { RoadmapNode, StudyPathResponse } from "@shared/types"

type RoadmapStatusLabel = "In progress" | "Up next" | "Locked" | "Completed"

const statusLabelMap: Record<RoadmapNode["status"], RoadmapStatusLabel> = {
  in_progress: "In progress",
  available: "Up next",
  locked: "Locked",
  completed: "Completed",
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
  const studentName = localStorage.getItem("studentName") ?? ""
  const subjectKey = (subject ?? "math").toLowerCase()
  const subjectName = useMemo(() => {
    if (!subject) return "Math"
    return subject.charAt(0).toUpperCase() + subject.slice(1)
  }, [subject])

  const accent = SUBJECT_COLORS[subjectKey] ?? SUBJECT_COLORS.default
  const icon = SUBJECT_ICONS[subjectKey] ?? SUBJECT_ICONS.default

  const [roadmap, setRoadmap] = useState<RoadmapNode[]>([])
  const [studyMeta, setStudyMeta] = useState<StudyPathResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolveApiUrl = useCallback(
    (path: string) => {
      return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
    },
    [apiBase]
  )

  const loadStudyPath = useCallback(async () => {
    const cachedStudyPath = localStorage.getItem("studyPath")
    if (cachedStudyPath) {
      try {
        const parsed = JSON.parse(cachedStudyPath) as RoadmapNode[]
        if (Array.isArray(parsed)) {
          setRoadmap(parsed)
        }
      } catch {
        // Ignore invalid cache
      }
    }

    if (!apiBase || !studentId) {
      if (!cachedStudyPath) {
        setError("Study path data is not available yet.")
      }
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(resolveApiUrl(`/study-path/${studentId}`))
      if (!response.ok) throw new Error("Failed to load your study path.")
      const data = (await response.json()) as StudyPathResponse
      if (Array.isArray(data.studyPath)) {
        setRoadmap(data.studyPath)
        localStorage.setItem("studyPath", JSON.stringify(data.studyPath))
      }
      setStudyMeta(data)
    } catch (err) {
      if (!cachedStudyPath) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    } finally {
      setLoading(false)
    }
  }, [apiBase, studentId, resolveApiUrl])

  useEffect(() => {
    void loadStudyPath()
  }, [loadStudyPath])

  const subjectNodes = useMemo(
    () => roadmap.filter((node) => node.subject.toLowerCase() === subjectKey),
    [roadmap, subjectKey]
  )

  const completedCount = subjectNodes.filter((node) => node.status === "completed").length
  const totalCount = subjectNodes.length
  const focusNodes = subjectNodes.filter(
    (node) => node.status === "available" || node.status === "in_progress"
  )
  const nextNode =
    subjectNodes.find((node) => node.status === "in_progress") ??
    subjectNodes.find((node) => node.status === "available")

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
            {studentName ? `Welcome back, ${studentName}` : "Welcome back"}
          </h1>
          <p className="mt-2 text-[16px] text-muted-foreground">
            Your study path is ready. Keep the streak going.
          </p>
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
                <div className="flex items-center gap-2">
                  <span className="text-xl" style={{ color: accent }}>
                    {icon}
                  </span>
                  <h2 className="text-[22px] font-sans font-bold text-foreground">
                    {subjectName} — {nextNode.topic}
                  </h2>
                </div>
                <p className="text-[14px] text-muted-foreground mb-6">
                  {focusNodes.length} focus {focusNodes.length === 1 ? "block" : "blocks"}
                </p>
              </>
            )}

            {studyMeta?.xp !== undefined && studyMeta?.level !== undefined && (
              <>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
                  XP
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {studyMeta.xp} XP • Level {studyMeta.level}
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
                  {completedCount} / {totalCount} completed
                </span>
              )}
            </div>

            {loading && (
              <div className="rounded-xl border border-[#E6D7C5] bg-white/70 p-4 text-sm text-muted-foreground">
                Loading your roadmap...
              </div>
            )}

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
                {subjectNodes.map((node) => {
                  const statusLabel = statusLabelMap[node.status]
                  const locked = node.status === "locked"
                  const onClick = () => {
                    if (locked) return
                    if (node.status === "completed") {
                      navigate(`/tutor/${subjectKey}?mode=review&topic=${encodeURIComponent(node.topic)}`)
                      return
                    }
                    navigate(`/tutor/${subjectKey}?mode=sprint&duration=25&topic=${encodeURIComponent(node.topic)}`)
                  }

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={onClick}
                      title={locked ? "Complete previous nodes first" : ""}
                      className={`roadmap-node ${locked ? "locked" : ""} text-left rounded-xl border border-[#E6D7C5] bg-white/80 p-4`}
                    >
                      <p className="text-[11px] font-semibold tracking-[0.07em] uppercase text-muted-foreground mb-2">
                        {node.subject}
                      </p>
                      <h3 className="text-[18px] font-sans font-bold text-foreground mb-3">
                        {node.topic}
                      </h3>
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-3 text-[12px] font-medium ${
                          statusStyles[statusLabel]
                        }`}
                      >
                        {statusLabel}
                      </span>
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
                onClick={() =>
                  navigate(`/tutor/${subjectKey}?mode=sprint&duration=25&topic=${encodeURIComponent(nextNode.topic)}`)
                }
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
