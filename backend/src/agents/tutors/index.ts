import Anthropic from '@anthropic-ai/sdk'
import { tutorTools, executeTool } from '../tools'
import { getTutorPrompt } from '../../prompts/tutors'
import type { AgentActivity, TutorMessageResponse } from '../../../../shared/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Agentic Tutor Loop ───────────────────────────────────────────────────────
// Claude decides which tools to call, in what order, autonomously.
// We just run the loop until Claude says it's done (stop_reason = 'end_turn').

export async function runTutorAgent(
  studentId: string,
  subject: string,
  message: string,
  sessionHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  mode: 'lesson' | 'chat' = 'chat',
  topic?: string,
): Promise<TutorMessageResponse> {
  const agentActivity: AgentActivity[] = []
  const sessionId = `${studentId}-${subject}-${Date.now()}`

  const addActivity = (agent: AgentActivity['agent'], action: string) => {
    agentActivity.push({ agent, action, timestamp: new Date().toISOString() })
  }

  addActivity('orchestrator', `Routing message to ${subject} tutor agent...`)

  // Build message history for this session
  const messages: Anthropic.MessageParam[] = [
    ...sessionHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  let finalReply = ''
  let xpGained = 0

  // ── Agent loop ──────────────────────────────────────────────────────────────
  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: getTutorPrompt(subject, studentId, mode, topic),
      tools: tutorTools,
      messages,
    })

    // Collect any text content as the reply
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        finalReply = block.text
      }
    }

    // Claude is done — no more tool calls
    if (response.stop_reason === 'end_turn') {
      addActivity('tutor', 'Response ready.')
      break
    }

    // Claude wants to call tools — execute each one
    if (response.stop_reason === 'tool_use') {
      // Add Claude's response (with tool calls) to message history
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        addActivity(
          block.name === 'read_student_memory' ? 'memory' :
          block.name === 'update_student_memory' ? 'memory' :
          block.name === 'flag_knowledge_gap' ? 'assessment' :
          block.name === 'unlock_next_node' ? 'orchestrator' : 'tutor',
          `Calling ${block.name}...`,
        )

        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          addActivity,
        )

        // Track XP from memory updates
        if (block.name === 'update_student_memory') {
          const parsed = JSON.parse(result)
          if (parsed.xpGained) xpGained = parsed.xpGained
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }

      // Feed tool results back to Claude → it decides next step
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Any other stop reason — break
    break
  }

  return {
    reply: finalReply || 'I had trouble generating a response. Please try again.',
    sessionId,
    agentActivity,
    memoryUpdated: agentActivity.some(a => a.action.includes('Saving session')),
    xpGained,
  }
}
