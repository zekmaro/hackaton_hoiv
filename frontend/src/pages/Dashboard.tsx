import type { CSSProperties } from "react"
import { useNavigate } from "react-router-dom"
import { SUBJECT_COLORS, SUBJECT_ICONS } from "../lib/subject-colors"

const subjects = [
  { name: "Math", level: "Intermediate", sessions: 4, nodes: 2, xp: "650 XP" },
  { name: "Physics", level: "University", sessions: 2, nodes: 1, xp: "+1 more" },
  { name: "CS", level: "Advanced", sessions: 6, nodes: 3, xp: "780 XP" },
  { name: "History", level: "Beginner", sessions: 1, nodes: 0, xp: "+2 more" },
  { name: "Biology", level: "Intermediate", sessions: 3, nodes: 2, xp: "420 XP" },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#0A0C0F] text-[#F0F2F5] pt-16 font-wow-body">
      <div className="mx-auto max-w-[1200px] px-10 py-10">
        <div className="mb-8">
          <h1 className="text-[28px] font-wow-display font-bold">Your subjects</h1>
          <p className="text-[14px] text-[#8B909A] mt-1">
            Click a subject to start studying
          </p>
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {subjects.map((subject, index) => {
            const key = subject.name.toLowerCase()
            const accent = SUBJECT_COLORS[key] ?? SUBJECT_COLORS.default
            const icon = SUBJECT_ICONS[key] ?? SUBJECT_ICONS.default

            return (
            <button
              key={subject.name}
              type="button"
              onClick={() => navigate(`/dashboard/${subject.name.toLowerCase()}`)}
              className="subject-card group relative w-full overflow-hidden rounded-2xl border border-[#1F2430] bg-[#111318] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:[border-color:var(--accent-border)]"
              style={
                {
                  borderColor: "#1F2430",
                  "--accent": accent,
                  "--accent-border": `${accent}80`,
                  animationDelay: `${index * 80}ms`,
                } as CSSProperties
              }
            >
              <div
                className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${accent}0f 0%, transparent 70%)`,
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
                    <h2 className="text-[17px] font-wow-display font-bold text-[#F0F2F5]">
                      {subject.name}
                    </h2>
                  </div>
                </div>
                <span className="text-[#4A4F5C] text-[16px] rounded-md px-2 py-1 hover:bg-[#181C23] hover:text-[#8B909A] transition-colors">
                  •••
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                <span className="h-6 rounded-full border border-[#2A3040] bg-[#1F2430] px-3 text-[12px] text-[#8B909A] flex items-center">
                  {subject.level}
                </span>
                {subject.name === "History" && (
                  <span className="h-6 rounded-full border border-[#EF4444] bg-[rgba(239,68,68,0.15)] px-3 text-[12px] text-[#EF4444] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                    Exam Apr 17
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[#1F2430] pt-4">
                <div className="flex items-center gap-4 text-[13px] text-[#8B909A]">
                  <div className="flex items-center gap-2">
                    <span>💬</span>
                    <span>{subject.sessions} sessions</span>
                    <span className="ml-1 min-w-[18px] h-[18px] rounded-full border border-[#1F2430] bg-[#181C23] text-[11px] flex items-center justify-center">
                      {subject.sessions}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🛤</span>
                    <span className="min-w-[18px] h-[18px] rounded-full border border-[#1F2430] bg-[#181C23] text-[11px] flex items-center justify-center">
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
                  {subject.xp}
                </span>
              </div>
            </button>
          )})}

          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="w-full min-h-[140px] rounded-2xl border-2 border-dashed border-[#1F2430] text-[#4A4F5C] flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:border-[#92610A] hover:bg-[rgba(245,158,11,0.05)] hover:text-[#F59E0B]"
          >
            <span className="text-[22px]">+</span>
            <span className="text-[15px] font-wow-display font-semibold">+ New subject</span>
          </button>
        </div>
      </div>
    </main>
  )
}
