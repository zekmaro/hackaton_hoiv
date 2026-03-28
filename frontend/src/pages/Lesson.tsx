import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { RoadmapNode } from "@shared/types"
import VoiceMode from "../components/VoiceMode"

type SubjectProfileResponse = {
  weakTopics?: string[]
  lastSessionNote?: string | null
}

export default function Lesson() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const navigate = useNavigate()

  const apiBase = import.meta.env.VITE_API_URL ?? ""
  const studentId = localStorage.getItem("studentId") ?? ""
  const studentName = localStorage.getItem("studentName") ?? "Student"

  const decodedNodeId = useMemo(() => decodeURIComponent(nodeId ?? ""), [nodeId])

  const node = useMemo(() => {
    if (!decodedNodeId) return null
    const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    return studyPath.find(item => item.id === decodedNodeId) ?? null
  }, [decodedNodeId])

  const [weakTopics, setWeakTopics] = useState<string[]>([])
  const [lastSessionNote, setLastSessionNote] = useState<string | null>(null)
  const [contextLoaded, setContextLoaded] = useState(false)

  const resolveUrl = useCallback(
    (path: string) => apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`,
    [apiBase]
  )

  // Load student context (weak topics, last session note) — non-blocking
  useEffect(() => {
    if (!apiBase || !studentId || !node?.subject) { setContextLoaded(true); return }
    void (async () => {
      try {
        const res = await fetch(resolveUrl(`/study-path/${studentId}/${encodeURIComponent(node.subject)}`))
        if (res.ok) {
          const data = await res.json() as SubjectProfileResponse
          if (Array.isArray(data.weakTopics)) setWeakTopics(data.weakTopics.filter(Boolean))
          if (typeof data.lastSessionNote === "string" && data.lastSessionNote.trim()) {
            setLastSessionNote(data.lastSessionNote.trim())
          }
        }
      } catch { /* non-critical */ }
      finally { setContextLoaded(true) }
    })()
  }, [apiBase, studentId, node?.subject, resolveUrl])

  if (!node) {
    return (
      <main className="min-h-screen bg-[#0c1220] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-4">Lesson not found.</p>
          <button type="button" onClick={() => navigate("/dashboard")}
            className="rounded-xl bg-[#FF8C00] px-4 py-2 text-sm font-semibold text-white">
            Back to dashboard
          </button>
        </div>
      </main>
    )
  }

  // Show brief loading state while fetching context (usually < 300ms)
  if (!contextLoaded) {
    return (
      <main className="min-h-screen bg-[#0c1220] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full"
            style={{ background: "radial-gradient(circle at 35% 35%, #fbbf24, #92400e)", animation: "orb-think 2s ease-in-out infinite", boxShadow: "0 0 30px rgba(251,191,36,0.3)" }} />
          <p className="text-slate-500 text-sm">Preparing your lesson…</p>
        </div>
      </main>
    )
  }

  return (
    <VoiceMode
      onClose={() => navigate(`/dashboard/${encodeURIComponent(node.subject)}`)}
      subject={node.subject}
      realSubjectName={node.subject}
      topic={node.topic}
      mode="lesson"
      nodeId={node.id}
      studentId={studentId}
      apiBase={apiBase}
      initialMessages={[]}
      weakTopics={weakTopics}
      lastSessionNote={lastSessionNote}
    />
  )
}
