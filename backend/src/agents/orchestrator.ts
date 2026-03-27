import Anthropic from '@anthropic-ai/sdk'
// import { orchestratorPrompt } from '../prompts/orchestrator'
// import { readStudentMemory } from '../memory/client'
// import { getTutorAgent } from './tutors'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// TODO: Orchestrator Agent
// - Reads student memory from OpenClaw
// - Decides which subject tutor to activate
// - Injects memory context into tutor prompt
// - Collects agentActivity[] events throughout
// - Returns tutor response + activity log

export async function routeToTutor(_studentId: string, _subject: string, _message: string) {
  // TODO: implement
  throw new Error('orchestrator not implemented yet')
}

export async function generateStudyPath(_onboardData: unknown) {
  // TODO: implement
  // Call Claude with orchestratorPrompt + onboard data
  // Return structured RoadmapNode[]
  throw new Error('generateStudyPath not implemented yet')
}
