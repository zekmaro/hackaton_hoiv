import { Router } from 'express'
// TODO: import orchestrator agent and memory client
// import { generateStudyPath } from '../../agents/orchestrator'
// import { createStudentMemory } from '../../memory/client'

export const onboardRouter = Router()

// POST /api/onboard
// Creates student record, generates initial study path via orchestrator agent
// Request/Response shape: see shared/types.ts OnboardRequest / OnboardResponse
onboardRouter.post('/', async (req, res, next) => {
  try {
    // TODO: implement
    // 1. Validate request with zod
    // 2. Call orchestrator agent to generate study path
    // 3. Create student memory in OpenClaw
    // 4. Return OnboardResponse
    res.json({ message: 'onboard endpoint — TODO' })
  } catch (err) {
    next(err)
  }
})
