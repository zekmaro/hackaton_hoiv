import { Router } from 'express'
// TODO: import memory client
// import { readStudentMemory } from '../../memory/client'

export const memoryRouter = Router()

// GET /api/memory/:studentId
// Returns full student memory from OpenClaw
// Response shape: see shared/types.ts StudentMemory
memoryRouter.get('/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    // TODO: implement
    // 1. Call OpenClaw memory client
    // 2. Return StudentMemory
    res.json({ message: `memory for ${studentId} — TODO` })
  } catch (err) {
    next(err)
  }
})
