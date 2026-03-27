import { Router } from 'express'
// TODO: import assessment agent
// import { startAssessment, submitAssessment } from '../../agents/assessment'

export const assessmentRouter = Router()

// POST /api/assessment/start
// Spawns assessment agent, generates targeted problems for a topic
// Request/Response shape: see shared/types.ts AssessmentStartRequest / AssessmentStartResponse
assessmentRouter.post('/start', async (req, res, next) => {
  try {
    // TODO: implement
    // 1. Validate request (studentId, subject, topic)
    // 2. Spawn assessment agent
    // 3. Generate 2-3 problems at right difficulty
    // 4. Return AssessmentStartResponse
    res.json({ message: 'assessment start — TODO' })
  } catch (err) {
    next(err)
  }
})

// POST /api/assessment/submit
// Evaluates answers, updates memory, reports gaps back
// Request/Response shape: see shared/types.ts AssessmentSubmitRequest / AssessmentSubmitResponse
assessmentRouter.post('/submit', async (req, res, next) => {
  try {
    // TODO: implement
    // 1. Validate request (sessionId, studentId, answers[])
    // 2. Assessment agent evaluates each answer
    // 3. Identify gaps, calculate score
    // 4. Update student memory in OpenClaw
    // 5. Return AssessmentSubmitResponse with feedback[]
    res.json({ message: 'assessment submit — TODO' })
  } catch (err) {
    next(err)
  }
})
