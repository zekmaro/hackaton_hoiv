export type TutorLessonMode = "lecture" | "practice"

export type FeedbackVariant = "correct" | "partial" | "wrong"

export type DebriefTone = "strong" | "review"

export function buildTutorOpeningLine(params: {
  studentName: string
  subject: string
  mode: TutorLessonMode
  weakTopics?: string[]
  lastSessionNote?: string | null
}): string {
  const name = params.studentName.trim() || "there"
  const weak = params.weakTopics?.filter(Boolean) ?? []
  const lastNote = params.lastSessionNote?.trim()

  if (params.mode === "lecture") {
    if (lastNote) {
      return `Welcome back, ${name}. Last time: ${lastNote}. Let's build this from the ground up.`
    }
    if (weak.length > 0) {
      return `Welcome back, ${name}. We'll reinforce ${weak[0]} first, then build up the rest step by step.`
    }
    return `Welcome back, ${name}. Let's build this from the ground up.`
  }

  if (lastNote) {
    return `Good to see you, ${name}. Last session note: ${lastNote}. Let's test what you've learned.`
  }
  if (weak.length > 0) {
    return `Good to see you, ${name}. Last time ${weak[0]} felt tricky, so I included it today.`
  }
  return `Good to see you, ${name}. Let's test what you've learned in ${params.subject}.`
}

export function getTaskIntro(type: "conceptual" | "application" | "debugging" | "explanation"): string {
  if (type === "conceptual") return "Let me see if the concept is clear."
  if (type === "application") return "Time to apply this to a real situation."
  if (type === "debugging") return "Something is wrong here. Can you spot and fix it?"
  return "Explain this back to me in your own words."
}

export function getFeedbackVariant(score: number | undefined, isCorrect: boolean): FeedbackVariant {
  if (typeof score === "number") {
    if (score >= 1) return "correct"
    if (score >= 0.5) return "partial"
    return "wrong"
  }
  return isCorrect ? "correct" : "wrong"
}

export function getFeedbackLabel(variant: FeedbackVariant): string {
  if (variant === "correct") return "Correct"
  if (variant === "partial") return "Partially right"
  return "Not quite"
}

export function getDebriefTone(correctCount: number, totalTasks: number): DebriefTone {
  if (totalTasks <= 0) return "review"
  const ratio = correctCount / totalTasks
  return ratio >= 0.75 ? "strong" : "review"
}

export function buildDebriefCopy(params: {
  name: string
  subject: string
  correctCount: number
  totalTasks: number
}): { line: string; subline: string } {
  const name = params.name.trim() || "there"
  const tone = getDebriefTone(params.correctCount, params.totalTasks)
  if (tone === "strong") {
    return {
      line: `Good work today, ${name}.`,
      subline: `${params.subject} is looking strong. Move to the next node when ready.`,
    }
  }
  return {
    line: `Good work today, ${name}.`,
    subline: `Review the lecture once more before your next session.`,
  }
}

export function buildClientTutorNote(params: {
  subject: string
  correctCount: number
  totalTasks: number
}): string {
  const tone = getDebriefTone(params.correctCount, params.totalTasks)
  if (tone === "strong") {
    return `Core ideas in ${params.subject} look strong. Next step: increase speed on similar problems.`
  }
  return `Revisit the worked example for ${params.subject}, then retry practice with focus on explanation quality.`
}

