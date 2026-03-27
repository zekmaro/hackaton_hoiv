import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// TODO: Assessment Agent
// - Spawned by subject tutor when it detects a knowledge gap
// - Generates 2-3 targeted problems at right difficulty
// - Evaluates answers, identifies root gaps
// - Reports back to tutor + updates memory

export async function startAssessment(_studentId: string, _subject: string, _topic: string) {
  // TODO: implement
  // Call Claude with assessmentPrompt
  // Return Problem[]
  throw new Error('startAssessment not implemented yet')
}

export async function submitAssessment(_sessionId: string, _answers: unknown[]) {
  // TODO: implement
  // Evaluate answers, find gaps, calculate score
  // Return AssessmentSubmitResponse
  throw new Error('submitAssessment not implemented yet')
}
