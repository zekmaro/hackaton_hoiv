import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Dashboard from "./Dashboard"

describe("Dashboard tutor presence", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv("VITE_API_URL", "http://localhost:3001")
    localStorage.clear()
    localStorage.setItem("studentId", "student-1")
    localStorage.setItem(
      "tutorNotesBySubject",
      JSON.stringify({ physics: "Focus on threshold frequency wording." })
    )
  })

  it("shows tutor note on subject card when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          studentId: "student-1",
          studyPath: [
            {
              id: "node-1",
              subject: "Physics",
              topic: "Photoelectric effect",
              status: "available",
              priority: "high",
              estimatedMinutes: 30,
              dependsOn: [],
            },
          ],
        }),
      })
    )

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Physics/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Focus on threshold frequency wording\./i)).toBeInTheDocument()
  })
})
