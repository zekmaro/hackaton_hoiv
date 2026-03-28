import { describe, expect, it } from "vitest"
import {
  buildClientTutorNote,
  buildDebriefCopy,
  buildTutorOpeningLine,
  getDebriefTone,
  getFeedbackLabel,
  getFeedbackVariant,
  getTaskIntro,
} from "./tutor-ux"

describe("tutor UX helpers", () => {
  it("builds lecture opener with last session note when available", () => {
    const line = buildTutorOpeningLine({
      studentName: "Andi",
      subject: "Physics",
      mode: "lecture",
      weakTopics: ["photoelectric effect"],
      lastSessionNote: "Work on explaining threshold frequency clearly.",
    })
    expect(line).toContain("Andi")
    expect(line).toContain("Last time")
    expect(line).toContain("build this from the ground up")
  })

  it("builds practice opener with weak topic context", () => {
    const line = buildTutorOpeningLine({
      studentName: "Aisha",
      subject: "Calculus",
      mode: "practice",
      weakTopics: ["limits"],
    })
    expect(line).toContain("Aisha")
    expect(line).toContain("limits")
  })

  it("returns expected task intros", () => {
    expect(getTaskIntro("conceptual")).toContain("concept")
    expect(getTaskIntro("application")).toContain("apply")
    expect(getTaskIntro("debugging")).toContain("wrong")
    expect(getTaskIntro("explanation")).toContain("own words")
  })

  it("maps score/isCorrect to feedback variants", () => {
    expect(getFeedbackVariant(1, true)).toBe("correct")
    expect(getFeedbackVariant(0.5, false)).toBe("partial")
    expect(getFeedbackVariant(0, false)).toBe("wrong")
    expect(getFeedbackVariant(undefined, true)).toBe("correct")
    expect(getFeedbackVariant(undefined, false)).toBe("wrong")
  })

  it("maps feedback variant to label", () => {
    expect(getFeedbackLabel("correct")).toBe("Correct")
    expect(getFeedbackLabel("partial")).toBe("Partially right")
    expect(getFeedbackLabel("wrong")).toBe("Not quite")
  })

  it("builds debrief lines from score quality", () => {
    expect(getDebriefTone(4, 4)).toBe("strong")
    expect(getDebriefTone(3, 4)).toBe("strong")
    expect(getDebriefTone(2, 4)).toBe("review")

    const strong = buildDebriefCopy({
      name: "Alex",
      subject: "Math",
      correctCount: 4,
      totalTasks: 4,
    })
    expect(strong.subline).toContain("looking strong")

    const review = buildDebriefCopy({
      name: "Alex",
      subject: "Math",
      correctCount: 1,
      totalTasks: 4,
    })
    expect(review.subline).toContain("Review the lecture")
  })

  it("builds local tutor note for dashboard", () => {
    const strongNote = buildClientTutorNote({ subject: "History", correctCount: 4, totalTasks: 4 })
    const reviewNote = buildClientTutorNote({ subject: "History", correctCount: 1, totalTasks: 4 })
    expect(strongNote).toContain("History")
    expect(reviewNote).toContain("Revisit")
  })
})

