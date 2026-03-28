import { Router } from 'express'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { readStudentMemory, updateSubjectMemory, updateXPAndStreak, mergeStudyPath } from '../../memory/client'
import type { RoadmapNode } from '../../../../shared/types'

export const lessonRouter = Router()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── POST /api/lesson/content ─────────────────────────────────────────────────
// Generates a structured lesson (intro + key points + quiz) for a roadmap node.

const contentSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().uuid(),
})

lessonRouter.post('/content', async (req, res, next) => {
  try {
    const { nodeId, studentId } = contentSchema.parse(req.body)

    const student = await readStudentMemory(studentId)
    const memory = student.memory ?? {}
    const studyPath: RoadmapNode[] = memory.studyPath ?? []

    const node = studyPath.find(n => n.id === nodeId)
    if (!node) {
      res.status(404).json({ error: 'Node not found', code: 'NODE_NOT_FOUND', status: 404 })
      return
    }

    const subjectMemory = memory.subjects?.[node.subject] ?? {}
    const learningStyle = memory.learningStyle ?? 'mixed'
    const weakTopics: string[] = subjectMemory.weak ?? []

    const prompt = `You are generating a structured lesson for a student.

Subject: ${node.subject}
Topic: ${node.topic}
Student level: ${subjectMemory.level ?? 'university'}
Learning style: ${learningStyle}
Student's weak areas: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'none identified yet'}

Generate a focused lesson with this EXACT JSON structure:
{
  "lesson": {
    "intro": "2-3 sentence engaging introduction to the topic",
    "keyPoints": [
      {
        "title": "concept name",
        "explanation": "clear explanation in 2-3 sentences",
        "example": "concrete example or worked calculation"
      }
    ],
    "quiz": [
      {
        "question": "question text",
        "options": ["option A", "option B", "option C", "option D"],
        "correctIndex": 0,
        "explanation": "why this answer is correct"
      }
    ],
    "summary": "1-2 sentences summarising what was learned",
    "xpReward": 50
  }
}

Rules:
- keyPoints: exactly 3 items
- quiz: exactly 3 questions
- If learning style is "examples", lead explanations with worked examples
- If student has weak areas related to this topic, address them explicitly
- Keep language clear and at the right level
- Return ONLY the raw JSON, no markdown`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude did not return valid lesson JSON')

    const parsed = JSON.parse(match[0])

    res.json({
      lesson: parsed.lesson,
      node,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
      res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND', status: 404 })
      return
    }
    next(err)
  }
})

// ─── POST /api/lesson/complete ────────────────────────────────────────────────
// Marks a node as completed, unlocks next node, awards XP.

const completeSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().uuid(),
  score: z.number().min(0).max(10),
})

lessonRouter.post('/complete', async (req, res, next) => {
  try {
    const { nodeId, studentId, score } = completeSchema.parse(req.body)

    const student = await readStudentMemory(studentId)
    const memory = student.memory ?? {}
    const studyPath: RoadmapNode[] = memory.studyPath ?? []

    const nodeIndex = studyPath.findIndex(n => n.id === nodeId)
    if (nodeIndex === -1) {
      res.status(404).json({ error: 'Node not found', code: 'NODE_NOT_FOUND', status: 404 })
      return
    }

    // Mark node completed
    studyPath[nodeIndex] = { ...studyPath[nodeIndex], status: 'completed' }

    // Unlock next node for same subject
    const subject = studyPath[nodeIndex].subject
    const nextNode = studyPath.find(
      (n, i) => i > nodeIndex && n.subject === subject && n.status === 'locked'
    )
    if (nextNode) {
      const nextIndex = studyPath.indexOf(nextNode)
      studyPath[nextIndex] = { ...studyPath[nextIndex], status: 'available' }
    }

    await mergeStudyPath(studentId, studyPath)

    // XP: base 50 + 15 per correct answer
    const xpGained = 50 + score * 15
    await updateXPAndStreak(studentId, xpGained)

    // Update subject memory
    const subjectMemory = memory.subjects?.[subject] ?? {}
    await updateSubjectMemory(studentId, subject, {
      ...subjectMemory,
      sessionsCount: (subjectMemory.sessionsCount ?? 0) + 1,
      lastSession: new Date().toISOString(),
      lastNote: `Completed lesson: ${studyPath[nodeIndex].topic}, score: ${score}`,
    })

    res.json({
      xpGained,
      nodeUnlocked: nextNode?.topic ?? null,
      message: 'Lesson completed',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', status: 400 })
      return
    }
    if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
      res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND', status: 404 })
      return
    }
    next(err)
  }
})
