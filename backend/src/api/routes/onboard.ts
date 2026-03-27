import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { runOnboardInterview, generateStudyPath } from '../../agents/orchestrator'
import { createStudentMemory } from '../../memory/client'
import type { OnboardResponse } from '../../../../shared/types'

export const onboardRouter = Router()

// ─── POST /api/onboard/chat ───────────────────────────────────────────────────
// One turn of the conversational onboarding interview.
// Call repeatedly as student responds. When done: true, proceed to /complete.

const chatSchema = z.object({
  name: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
})

onboardRouter.post('/chat', async (req, res, next) => {
  try {
    const { name, messages } = chatSchema.parse(req.body)
    const result = await runOnboardInterview(name, messages)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    next(err)
  }
})

// ─── POST /api/onboard/complete ───────────────────────────────────────────────
// Finalizes onboarding: generates study path + creates student in Postgres.
// Call once after /chat returns done: true.

const completeSchema = z.object({
  name: z.string().min(1),
  extracted: z.object({
    subjects: z.array(z.object({
      name: z.string(),
      level: z.string(),
      currentStruggles: z.string(),
    })),
    goals: z.string(),
    examDates: z.array(z.object({
      subject: z.string(),
      date: z.string(),
    })),
    studyHoursPerDay: z.number(),
    learningStyle: z.enum(['examples', 'theory', 'mixed']),
  }),
  syllabus: z.string().optional(),
})

onboardRouter.post('/complete', async (req, res, next) => {
  try {
    const { name, extracted, syllabus } = completeSchema.parse(req.body)
    const studentId = randomUUID()

    // Generate personalized study path via Claude (with optional syllabus)
    const studyPath = await generateStudyPath({ name, ...extracted }, syllabus)

    const topNode = studyPath[0]
    const nextFocus = topNode
      ? `Start with ${topNode.subject} — ${topNode.topic}`
      : `Start with ${extracted.subjects[0]?.name ?? 'your first subject'}`

    // Build initial memory structure
    const initialMemory: Record<string, object> = {}
    for (const subject of extracted.subjects) {
      initialMemory[subject.name] = {
        weak: subject.currentStruggles ? [subject.currentStruggles] : [],
        strong: [],
        level: subject.level,
        lastSession: null,
        sessionsCount: 0,
        averageScore: 0,
      }
    }

    await createStudentMemory(studentId, {
      name,
      memory: {
        subjects: initialMemory,
        examDates: extracted.examDates,
        goals: extracted.goals,
        learningStyle: extracted.learningStyle,
        studyHoursPerDay: extracted.studyHoursPerDay,
        studyPath,
        syllabus: syllabus ?? null,
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
