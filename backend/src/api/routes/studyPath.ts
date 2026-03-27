import { Router } from 'express'
// TODO: import memory client
// import { readStudentMemory } from '../../memory/client'

export const studyPathRouter = Router()

// GET /api/study-path/:studentId
// Reads memory and returns current roadmap + XP + streak
// Response shape: see shared/types.ts StudyPathResponse
studyPathRouter.get('/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    // TODO: implement
    // 1. Read student memory from OpenClaw
    // 2. Recalculate roadmap priorities based on exam dates
    // 3. Return StudyPathResponse
    res.json({ message: `study-path for ${studentId} — TODO` })
  } catch (err) {
    next(err)
  }
})
