import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { RoadmapNode } from "@shared/types"

export default function Lesson() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const navigate = useNavigate()
  const decodedNodeId = useMemo(() => decodeURIComponent(nodeId ?? ""), [nodeId])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!decodedNodeId) {
      setError("Lesson not found.")
      return
    }
    const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
    const node = studyPath.find((item) => item.id === decodedNodeId)
    if (!node) {
      setError("Lesson not found.")
      return
    }
    navigate(
      `/tutor/${encodeURIComponent(node.subject)}?mode=lesson&topic=${encodeURIComponent(
        node.topic
      )}&nodeId=${encodeURIComponent(node.id)}`,
      { replace: true }
    )
  }, [decodedNodeId, navigate])

  return (
    <main className="lesson-page px-6 py-12 text-foreground font-sans">
      <div className="mx-auto max-w-3xl">
        {error ? (
          <>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-4 rounded-xl bg-[#FF8C00] px-4 py-2 text-sm font-semibold text-white"
            >
              Back to dashboard
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Opening lesson...</p>
        )}
      </div>
    </main>
  )
}
