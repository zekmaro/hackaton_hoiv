import Anthropic from '@anthropic-ai/sdk'
import { studyPathPrompt } from '../prompts/orchestrator'
import type { RoadmapNode, OnboardRequest } from '../../../shared/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateStudyPath(onboardData: OnboardRequest): Promise<RoadmapNode[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: studyPathPrompt(onboardData),
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON array from response (Claude sometimes adds markdown)
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Claude did not return a valid JSON array')

  return JSON.parse(match[0]) as RoadmapNode[]
}
