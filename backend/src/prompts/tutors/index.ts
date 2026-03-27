import { mathTutorPrompt } from './math'

// Add new subjects here as you build them
// Each subject just needs its own prompt file following the same pattern as math.ts

const tutorPrompts: Record<string, (context: unknown) => string> = {
  math: mathTutorPrompt,
  // physics: physicsTutorPrompt,
  // chemistry: chemistryTutorPrompt,
  // history: historyTutorPrompt,
  // cs: csTutorPrompt,
}

export function getTutorPrompt(subject: string, studentContext: unknown): string {
  const promptFn = tutorPrompts[subject.toLowerCase()]
  if (!promptFn) {
    // Fallback generic tutor for any subject not yet specialized
    return genericTutorPrompt(subject, studentContext)
  }
  return promptFn(studentContext)
}

function genericTutorPrompt(subject: string, studentContext: unknown): string {
  return `You are an expert ${subject} tutor — patient, clear, and encouraging.
Adapt to the student's level based on their history.

Student context: ${JSON.stringify(studentContext, null, 2)}

Always respond with JSON:
{
  "reply": "your explanation here",
  "gapDetected": boolean,
  "gapTopic": "specific topic if gap detected, else null",
  "xpGained": number (10-50),
  "agentActivity": [{ "agent": "tutor", "action": "description", "timestamp": "ISO" }]
}`
}
