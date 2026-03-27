import { Router } from 'express'
// TODO: import orchestrator agent
// import { routeToTutor } from '../../agents/orchestrator'

export const tutorRouter = Router()

// POST /api/tutor/message
// Orchestrator reads memory, spawns correct subject tutor agent, returns response
// Request/Response shape: see shared/types.ts TutorMessageRequest / TutorMessageResponse
tutorRouter.post('/message', async (req, res, next) => {
  try {
    // TODO: implement
    // 1. Validate request (studentId, subject, message, voiceMode)
    // 2. Read student memory from OpenClaw
    // 3. Orchestrator decides which tutor agent to spawn
    // 4. Tutor agent generates reply with injected memory context
    // 5. Update memory via OpenClaw
    // 6. Return TutorMessageResponse with agentActivity[]
    res.json({ message: 'tutor message endpoint — TODO' })
  } catch (err) {
    next(err)
  }
})
