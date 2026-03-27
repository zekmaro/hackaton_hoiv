import Anthropic from '@anthropic-ai/sdk'
import { studyPathPrompt, orchestratorPrompt } from '../prompts/orchestrator'
import { onboardInterviewPrompt } from '../prompts/onboardInterview'
import type {
  RoadmapNode,
  ExtractedOnboardData,
  OnboardChatMessage,
} from '../../../shared/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Onboarding Interview ─────────────────────────────────────────────────────

// One turn of the conversational onboarding interview.
// Returns the AI reply and whether it has collected enough info.
export async function runOnboardInterview(
  name: string,
  messages: OnboardChatMessage[],
): Promise<{ reply: string; done: boolean; extracted?: ExtractedOnboardData }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', // fast for chat turns
    max_tokens: 512,
    system: onboardInterviewPrompt(name),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Check if Claude signals it has enough info
  const readyMatch = text.match(/READY:(\{[\s\S]*\})/)
  if (readyMatch) {
    const extracted = JSON.parse(readyMatch[1]) as ExtractedOnboardData
    // Return the part before READY: as the final reply, or a default closing message
    const replyPart = text.replace(/READY:[\s\S]*/, '').trim()
    return {
      reply: replyPart || `Great, I have everything I need ${name}! Let me build your personalized study plan now...`,
      done: true,
      extracted,
    }
  }

  return { reply: text, done: false }
}

// ─── Study Path Generation ────────────────────────────────────────────────────

export async function generateStudyPath(
  onboardData: ExtractedOnboardData & { name: string },
  syllabus?: string,
): Promise<RoadmapNode[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: studyPathPrompt(onboardData, syllabus),
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Claude did not return a valid JSON array')

  return JSON.parse(match[0]) as RoadmapNode[]
}
