import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { generateStudyPath } from '../../agents/orchestrator'
import { createStudentMemory } from '../../memory/client'
import type { OnboardResponse } from '../../../../shared/types'

export const onboardRouter = Router()

const onboardSchema = z.object({
  name: z.string().min(1),
  subjects: z.array(z.string()).min(1),
  examDates: z.array(z.object({
    subject: z.string(),
    date: z.string(),
  })),
  goals: z.string(),
  studyHoursPerDay: z.number().min(1).max(12),
})

onboardRouter.post('/', async (req, res, next) => {
  try {
    const data = onboardSchema.parse(req.body)
    const studentId = randomUUID()

    // Generate study path via Claude
    const studyPath = await generateStudyPath(data)

    // Pick the most urgent subject for the welcome message
    const topNode = studyPath[0]
    const nextFocus = topNode
      ? `Start with ${topNode.subject} — ${topNode.topic}`
      : `Start studying ${data.subjects[0]}`

    // Create initial memory in Postgres
    const initialMemory: Record<string, object> = {}
    for (const subject of data.subjects) {
      initialMemory[subject] = {
        weak: [],
        strong: [],
        lastSession: null,
        sessionsCount: 0,
        averageScore: 0,
      }
    }

    await createStudentMemory(studentId, {
      name: data.name,
      memory: {
        subjects: initialMemory,
        examDates: data.examDates,
        goals: data.goals,
        studyHoursPerDay: data.studyHoursPerDay,
        studyPath,
      },
    })

    const response: OnboardResponse = {
      studentId,
      studyPath,
      xp: 0,
      streak: 0,
      nextFocus,
    }

    res.json(response)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    next(err)
  }
})
