import type { CSSProperties } from "react"
import { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { SUBJECT_COLORS, SUBJECT_ICONS } from "../lib/subject-colors"

const roadmapNodes = [
  { title: "Functions", status: "In progress" },
  { title: "Derivatives", status: "Up next" },
  { title: "Applications", status: "Locked" },
  { title: "Integrals", status: "Locked" },
  { title: "Limits", status: "Completed" },
  { title: "Practice set", status: "Completed" },
]

const badges = ["Focus 5", "Quiz Ace", "Week 1", "7-Day Streak"]

export default function SubjectDetail() {
  const { subject } = useParams<{ subject: string }>()
  const navigate = useNavigate()
  const subjectKey = (subject ?? "math").toLowerCase()
  const subjectName = useMemo(() => {
    if (!subject) return "Math"
    return subject.charAt(0).toUpperCase() + subject.slice(1)
  }, [subject])

  const accent = SUBJECT_COLORS[subjectKey] ?? SUBJECT_COLORS.default
  const icon = SUBJECT_ICONS[subjectKey] ?? SUBJECT_ICONS.default

  const xp = 650
  const xpMax = 1000
  const level = 4
  const xpPct = Math.min(Math.round((xp / xpMax) * 100), 100)

  const studyHoursPerDay = 1
  const sessionTitle =
    studyHoursPerDay <= 1
      ? "25 min Focus Sprint"
      : studyHoursPerDay <= 3
        ? "45 min Deep Dive"
        : "60 min Power Session"

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
            Welcome back, Aisha
          </h1>
          <p className="mt-2 text-[16px] text-muted-foreground">
            Your study path is ready. Keep the streak going.
          </p>
        </div>
        <div className="h-9 px-4 rounded-full bg-white/80 border border-[#E6D7C5] flex items-center gap-2 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
          <span className="text-[14px] text-foreground">Streak: 7 days</span>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6 items-start max-[900px]:grid-cols-1">
        <aside className="today-panel rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-4">
            Today
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl" style={{ color: accent }}>
              {icon}
            </span>
            <h2 className="text-[22px] font-sans font-bold text-foreground">
              {subjectName} + Biology
            </h2>
          </div>
          <p className="text-[14px] text-muted-foreground mb-6">2 focus blocks</p>

          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
            XP
          </p>
          <div className="h-2 rounded-full bg-[#E6D7C5] overflow-hidden mb-2">
            <div
              className="xp-fill h-full rounded-full"
              style={{
                "--xp-pct": `${xpPct}%`,
                background: "linear-gradient(90deg, #E67E00 0%, #FBBF24 50%, #E67E00 100%)",
                backgroundSize: "200% 100%",
              } as CSSProperties}
            />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {xp} / {xpMax} XP to Level {level}
          </p>

          <p className="mt-5 text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
            Badges
          </p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="h-7 px-3 rounded-full border border-[#E6D7C5] bg-white/80 text-[13px] text-foreground flex items-center"
              >
                {badge}
              </span>
            ))}
          </div>
        </aside>

        <div className="roadmap-panel">
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[20px] font-sans font-bold text-foreground">
                Your roadmap
              </h2>
              <span className="text-[14px] text-muted-foreground">Week 2 of 6</span>
            </div>

            <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-2">
              {roadmapNodes.map((node) => {
                const status = node.status
                const statusStyles: Record<string, string> = {
                  "In progress": "bg-[rgba(230,126,0,0.12)] border-[rgba(230,126,0,0.3)] text-[#B45309]",
                  "Up next": "bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.3)] text-[#1D4ED8]",
                  Locked: "bg-[rgba(0,0,0,0.05)] border-[rgba(0,0,0,0.1)] text-[#6B5B00]",
                  Completed: "bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.3)] text-[#15803D]",
                }

                const locked = status === "Locked"
                const onClick = () => {
                  if (locked) return
                  if (status === "Completed") {
                    navigate(`/tutor/${subjectKey}?mode=review`)
                    return
                  }
                  navigate(`/tutor/${subjectKey}?mode=sprint&duration=25`)
                }

                return (
                  <button
                    key={node.title}
                    type="button"
                    onClick={onClick}
                    title={locked ? "Complete previous nodes first" : ""}
                    className={`roadmap-node ${locked ? "locked" : ""} text-left rounded-xl border border-[#E6D7C5] bg-white/80 p-4`}
                  >
                    <p className="text-[11px] font-semibold tracking-[0.07em] uppercase text-muted-foreground mb-2">
                      {subjectName}
                    </p>
                    <h3 className="text-[18px] font-sans font-bold text-foreground mb-3">
                      {node.title}
                    </h3>
                    <span
                      className={`inline-flex h-6 items-center rounded-full border px-3 text-[12px] font-medium ${
                        statusStyles[status]
                      }`}
                    >
                      {status}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-6 flex items-center justify-between gap-4 max-[600px]:flex-col max-[600px]:items-start">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-2">
                Next session
              </p>
              <p className="text-[24px] font-sans font-bold text-foreground mb-1">
                {sessionTitle}
              </p>
              <p className="text-[14px] text-muted-foreground">Starts when you are ready</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/tutor/${subjectKey}?mode=sprint&duration=25`)}
              className="h-12 px-7 rounded-[10px] bg-[#FF8C00] text-white text-[15px] font-sans font-bold hover:bg-[#e07b00] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(255,140,0,0.35)] transition-all"
            >
              Start now
            </button>
          </section>
        </div>
      </div>
    </main>
  )
}
