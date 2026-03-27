import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { SUBJECT_COLORS, SUBJECT_ICONS } from "../lib/subject-colors"
import type { RoadmapNode, StudyPathResponse } from "@shared/types"

type SubjectCard = {
  name: string
  statusLabel: string
  sessions: number
  nodes: number
  progressLabel: string
  examDate?: string
}

const formatShortDate = (isoDate: string) => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId")
  const [roadmap, setRoadmap] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolveApiUrl = useCallback(
    (path: string) => {
      return apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
    },
    [apiBase]
  )

  const loadStudyPath = useCallback(async () => {
    if (!apiBase) {
      setError("Missing VITE_API_URL. Please configure the backend URL first.")
      setLoading(false)
      return
    }
    if (!studentId) {
      setError("No student profile found yet. Complete onboarding to create one.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(resolveApiUrl(`/study-path/${studentId}`))
      if (!response.ok) throw new Error("Failed to load your study path.")
      const data = (await response.json()) as StudyPathResponse
      setRoadmap(Array.isArray(data.studyPath) ? data.studyPath : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [apiBase, studentId, resolveApiUrl])

  useEffect(() => {
    void loadStudyPath()
  }, [loadStudyPath])

  const subjects = useMemo<SubjectCard[]>(() => {
    const grouped = new Map<string, RoadmapNode[]>()
    roadmap.forEach((node) => {
      const subjectName = node.subject?.trim() || "General"
      const list = grouped.get(subjectName)
      if (list) {
        list.push(node)
      } else {
        grouped.set(subjectName, [node])
      }
    })

    const cards: SubjectCard[] = []
    grouped.forEach((nodes, name) => {
      const totalNodes = nodes.length
      const completedNodes = nodes.filter((node) => node.status === "completed").length
      const hasInProgress = nodes.some((node) => node.status === "in_progress")
      const hasAvailable = nodes.some((node) => node.status === "available")
      const statusLabel = hasInProgress
        ? "In progress"
        : hasAvailable
          ? "Ready to learn"
          : completedNodes === totalNodes && totalNodes > 0
            ? "Completed"
            : "Locked"

      const examDates = nodes
        .map((node) => node.examDate)
        .filter((date): date is string => Boolean(date))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

      cards.push({
        name,
        statusLabel,
        sessions: completedNodes,
        nodes: totalNodes,
        progressLabel: `${completedNodes}/${totalNodes} nodes`,
        examDate: examDates[0],
      })
    })

    return cards.sort((a, b) => a.name.localeCompare(b.name))
  }, [roadmap])

  return (
    <main className="min-h-screen bg-background text-foreground pt-16 font-sans">
      <div className="mx-auto max-w-[1200px] px-8 md:px-10 py-10">
        <div className="mb-8">
          <h1 className="text-[28px] font-sans font-bold">Your subjects</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Click a subject to start studying
          </p>
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {loading && (
            <div className="col-span-full rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 text-sm text-muted-foreground">
              Loading your study path...
            </div>
          )}

          {!loading && error && (
            <div className="col-span-full rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-2">We couldn't load your subjects.</p>
              <p className="mb-4">{error}</p>
              <button
                type="button"
                onClick={() => void loadStudyPath()}
                className="rounded-xl bg-[#FF8C00] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && subjects.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[#E6D7C5] bg-[#FFF4CC]/60 p-6 text-sm text-muted-foreground">
              No subjects yet. Start onboarding to create your first tutor.
            </div>
          )}

          {!loading &&
            !error &&
            subjects.map((subject, index) => {
              const key = subject.name.toLowerCase()
              const accent = SUBJECT_COLORS[key] ?? SUBJECT_COLORS.default
              const icon = SUBJECT_ICONS[key] ?? SUBJECT_ICONS.default

              return (
                <button
                  key={subject.name}
                  type="button"
                  onClick={() => navigate(`/dashboard/${subject.name.toLowerCase()}`)}
                  className="subject-card group relative w-full overflow-hidden rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(90,62,54,0.18)] hover:[border-color:var(--accent-border)]"
                  style={
                    {
                      borderColor: "#E6D7C5",
                      "--accent": accent,
                      "--accent-border": `${accent}80`,
                      animationDelay: `${index * 80}ms`,
                    } as CSSProperties
                  }
                >
                  <div
                    className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
                    }}
                  />

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-[10px] flex items-center justify-center text-base"
                        style={{
                          background: `${accent}1f`,
                          border: `1px solid ${accent}4d`,
                          color: accent,
                        }}
                      >
                        {icon}
                      </div>
                      <div>
                        <h2 className="text-[17px] font-sans font-bold text-foreground">
                          {subject.name}
                        </h2>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-[16px] rounded-md px-2 py-1 hover:bg-[#FFEC99]/70 hover:text-foreground transition-colors">
                      •••
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="h-6 rounded-full border border-[#E6D7C5] bg-white/80 px-3 text-[12px] text-muted-foreground flex items-center">
                      {subject.statusLabel}
                    </span>
                    {subject.examDate && (
                      <span className="h-6 rounded-full border border-[#EF4444]/50 bg-[rgba(239,68,68,0.12)] px-3 text-[12px] text-[#EF4444] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                        Exam {formatShortDate(subject.examDate)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#E6D7C5] pt-4">
                    <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>💬</span>
                        <span>{subject.sessions} sessions</span>
                        <span className="ml-1 min-w-[18px] h-[18px] rounded-full border border-[#E6D7C5] bg-white/80 text-[11px] flex items-center justify-center">
                          {subject.sessions}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>🛤</span>
                        <span className="min-w-[18px] h-[18px] rounded-full border border-[#E6D7C5] bg-white/80 text-[11px] flex items-center justify-center">
                          {subject.nodes}
                        </span>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[13px] font-semibold"
                      style={{
                        color: accent,
                        background: `${accent}1a`,
                        border: `1px solid ${accent}4d`,
                      }}
                    >
                      {subject.progressLabel}
                    </span>
                  </div>
                </button>
              )
            })}

          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="w-full min-h-[140px] rounded-2xl border-2 border-dashed border-[#E6D7C5] text-muted-foreground flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:border-[#FF8C00] hover:bg-[#FFEC99]/70 hover:text-[#FF8C00]"
          >
            <span className="text-[22px]">+</span>
            <span className="text-[15px] font-sans font-semibold">+ New subject</span>
          </button>
        </div>
      </div>
    </main>
  )
}
