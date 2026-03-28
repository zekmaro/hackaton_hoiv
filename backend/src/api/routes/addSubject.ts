import { Router } from 'express'
import { z } from 'zod'
import { generateStudyPath } from '../../agents/orchestrator'
import { readStudentMemory, updateSubjectMemory, mergeStudyPath } from '../../memory/client'

export const addSubjectRouter = Router()

// POST /api/tutor/add
// Adds a new subject to an existing student — called when they click "+ Add subject"
// Same onboarding chat flow, but student already exists in DB

const schema = z.object({
  studentId: z.string().uuid(),
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
    studyHoursPerDay: z.coerce.number().default(2),
    learningStyle: z.string().transform(val => {
      if (val.includes('example')) return 'examples'
      if (val.includes('theor')) return 'theory'
      return 'mixed'
    }),
    focusTopic: z.string().optional(),
  }),
  syllabus: z.string().optional(),
})

addSubjectRouter.post('/add', async (req, res, next) => {
  try {
    const { studentId, extracted, syllabus } = schema.parse(req.body)

    // Read existing student
    const student = await readStudentMemory(studentId)

    // Generate roadmap for the new subject only
    const newNodes = await generateStudyPath(
      { name: student.name, ...extracted },
      syllabus,
    )

    // Add new subject to memory
    for (const subject of extracted.subjects) {
      await updateSubjectMemory(studentId, subject.name, {
        weak: subject.currentStruggles ? [subject.currentStruggles] : [],
        strong: [],
        level: subject.level,
        lastSession: null,
        sessionsCount: 0,
        averageScore: 0,
        examDates: extracted.examDates.filter(e => e.subject === subject.name),
      })
    }

    // Merge new nodes into the top-level studyPath array
    const existingStudyPath = student.memory?.studyPath ?? []
    await mergeStudyPath(studentId, [...existingStudyPath, ...newNodes])

    res.json({
      studyPath: newNodes,
      nextFocus: newNodes[0]
        ? `Start with ${newNodes[0].subject} — ${newNodes[0].topic}`
        : `Start with ${extracted.subjects[0]?.name}`,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    next(err)
  }
})
