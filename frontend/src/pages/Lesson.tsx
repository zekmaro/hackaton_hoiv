import { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { RoadmapNode } from "@shared/types"

const PHASES = ["Lecture", "Practice", "Challenge", "Complete"] as const

export default function Lesson() {
  const { nodeId, lessonMode } = useParams<{ nodeId: string; lessonMode?: string }>()
  const navigate = useNavigate()
  const decodedNodeId = useMemo(() => decodeURIComponent(nodeId ?? ""), [nodeId])

  const node = useMemo(() => {
    if (!decodedNodeId) return null
    const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    return studyPath.find((item) => item.id === decodedNodeId) ?? null
  }, [decodedNodeId])

  const mode = (lessonMode ?? "").toLowerCase()
  const launchTutor = (selectedMode: "lecture" | "practice") => {
    if (!node) return
    navigate(
      `/tutor/${encodeURIComponent(node.subject)}?mode=lesson&lessonMode=${selectedMode}&topic=${encodeURIComponent(
        node.topic
      )}&nodeId=${encodeURIComponent(node.id)}`,
      { replace: true }
    )
  }

  if (!node) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] px-6 py-12 text-foreground font-sans">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Lesson not found.</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-4 rounded-xl bg-[#FF8C00] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    )
  }

  if (mode === "lecture" || mode === "practice") {
    launchTutor(mode)
    return <main className="min-h-screen bg-[#F8F7F4]" />
  }

  return (
    <main className="min-h-screen bg-[#F8F7F4] text-foreground font-sans">
      <div className="h-[52px] bg-white border-b border-[#EBEBEB] px-6 md:px-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-[#6B7280] hover:text-[#1A1500]"
        >
          ← {node.title ?? node.topic} ({node.subject})
        </button>
        <div className="hidden md:flex items-center">
          {PHASES.map((phase, index) => (
            <div key={phase} className="flex items-center">
              <span className="h-7 px-3 rounded-full text-xs font-semibold text-[#9CA3AF]">
                {phase}
              </span>
              {index < PHASES.length - 1 && (
                <span className="w-8 h-px bg-[#D1D5DB] mx-1" />
              )}
            </div>
          ))}
        </div>
        <span className="w-6" />
      </div>

      <section className="min-h-[calc(100vh-52px)] px-6 py-12 md:py-16 flex flex-col items-center justify-center">
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#9CA3AF] mb-2 text-center">
          {node.subject} — {node.topic}
        </p>
        <h1 className="text-[34px] md:text-[38px] leading-[1.12] font-extrabold text-[#111827] text-center max-w-[680px] mb-4">
          {node.title ?? node.topic}
        </h1>
        <p className="text-[15px] leading-7 text-[#6B7280] text-center max-w-[520px] mb-10">
          Choose how you want to learn this topic first. Start with Lecture for explanation or
          jump into Practice for exercises.
        </p>

        <div className="w-full max-w-[720px] grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate(`/lesson/${encodeURIComponent(node.id)}/lecture`)}
            className="text-left rounded-[20px] border-2 border-[#E5E7EB] bg-white p-7 transition-all hover:-translate-y-1 hover:border-[#F59E0B] hover:shadow-[0_12px_32px_rgba(245,158,11,0.14)]"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706] text-xl mb-5">
              📘
            </div>
            <h2 className="text-[22px] font-bold text-[#111827] mb-2">Lecture</h2>
            <p className="text-sm leading-6 text-[#6B7280] mb-5">
              Read or listen to a guided explanation with key concepts and examples.
            </p>
            <ul className="space-y-1.5 text-[13px] text-[#6B7280]">
              <li>• Written explanation</li>
              <li>• Voice mode available</li>
              <li>• Key concept cards</li>
              <li>• Comprehension check</li>
            </ul>
            <p className="mt-5 pt-4 border-t border-[#F3F4F6] text-[13px] text-[#9CA3AF]">
              ~{node.estimatedMinutes} min
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/lesson/${encodeURIComponent(node.id)}/practice`)}
            className="text-left rounded-[20px] border-2 border-[#E5E7EB] bg-white p-7 transition-all hover:-translate-y-1 hover:border-[#22C55E] hover:shadow-[0_12px_32px_rgba(34,197,94,0.14)]"
          >
            <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] flex items-center justify-center text-[#16A34A] text-xl mb-5">
              ✏️
            </div>
            <h2 className="text-[22px] font-bold text-[#111827] mb-2">Practice</h2>
            <p className="text-sm leading-6 text-[#6B7280] mb-5">
              Solve targeted exercises and get instant feedback on your answers.
            </p>
            <ul className="space-y-1.5 text-[13px] text-[#6B7280]">
              <li>• 3 graded tasks</li>
              <li>• Step-by-step hints</li>
              <li>• Instant feedback</li>
              <li>• XP for correct answers</li>
            </ul>
            <p className="mt-5 pt-4 border-t border-[#F3F4F6] text-[13px] text-[#9CA3AF]">
              ~{Math.max(20, node.estimatedMinutes - 5)} min
            </p>
          </button>
        </div>
      </section>
    </main>
  )
}
