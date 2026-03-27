import Anthropic from '@anthropic-ai/sdk'
// import { getTutorPrompt } from '../../prompts/tutors'
// import { SubjectMemory } from '../../../../shared/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Subject Tutor Agent factory
// Each subject gets the same agent logic but a different system prompt
// Prompts live in src/prompts/tutors/[subject].ts

export async function runTutorAgent(
  _subject: string,
  _message: string,
  _memory: unknown,
  _sessionId?: string,
) {
  // TODO: implement
  // 1. Get subject-specific system prompt from prompts/tutors/
  // 2. Inject student memory context
  // 3. Call Claude with conversation history
  // 4. Check if gap detected → spawn assessment agent
  // 5. Return reply + agentActivity[]
  throw new Error('tutorAgent not implemented yet')
}
