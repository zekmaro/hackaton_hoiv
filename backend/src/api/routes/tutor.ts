import { Router } from 'express'
import { z } from 'zod'
import { runTutorAgent, runTutorAgentStream } from '../../agents/tutors'

export const tutorRouter = Router()

const messageSchema = z.object({
  studentId: z.string().uuid(),
  subject: z.string().min(1),
  message: z.string().min(1),
  voiceMode: z.boolean().default(false),
  mode: z.enum(['lesson', 'chat']).default('chat'),
  topic: z.string().optional(),
  nodeId: z.string().optional(),
  sessionId: z.string().optional(),
  sessionHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
})

// POST /api/tutor/message/stream
// Streaming version — SSE, chunks arrive as they are generated
tutorRouter.post('/message/stream', async (req, res, next) => {
  try {
    const { studentId, subject, message, sessionHistory, mode, topic } = messageSchema.parse(req.body)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // disable nginx/railway buffering
    res.flushHeaders()

    await runTutorAgentStream(studentId, subject, message, sessionHistory, mode, topic, res)
    res.end()
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    next(err)
  }
})

// POST /api/tutor/message
// Agentic tutor — Claude decides what tools to call, memory is read/written automatically
tutorRouter.post('/message', async (req, res, next) => {
  try {
    const { studentId, subject, message, sessionHistory, mode, topic } = messageSchema.parse(req.body)

    const result = await runTutorAgent(studentId, subject, message, sessionHistory, mode, topic)

    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    next(err)
  }
})
