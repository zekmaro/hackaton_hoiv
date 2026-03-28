import { Router } from 'express'
import { readStudentMemory } from '../../memory/client'
import type { StudyPathResponse, RoadmapNode } from '../../../../shared/types'

export const studyPathRouter = Router()

// GET /api/study-path/:studentId
studyPathRouter.get('/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    const student = await readStudentMemory(studentId)

    const memory = student.memory ?? {}
    const studyPath: RoadmapNode[] = memory.studyPath ?? []
    const examDates: { subject: string; date: string }[] = memory.examDates ?? []

    // Find next upcoming exam
    const now = Date.now()
    const upcoming = examDates
      .map(e => ({ ...e, ms: new Date(e.date).getTime() }))
      .filter(e => e.ms > now)
      .sort((a, b) => a.ms - b.ms)

    const nextExam = upcoming[0]
      ? {
          subject: upcoming[0].subject,
          date: upcoming[0].date,
          daysLeft: Math.ceil((upcoming[0].ms - now) / 86400000),
        }
      : null

    // Today's focus = first available node, prioritising subject with soonest exam
    const availableNodes = studyPath.filter(n => n.status === 'available')
    const focusNode = nextExam
      ? (availableNodes.find(n => n.subject === nextExam.subject) ?? availableNodes[0])
      : availableNodes[0]

    const todaysFocus = focusNode
      ? {
          subject: focusNode.subject,
          topic: focusNode.topic,
          reason: nextExam ? `Exam in ${nextExam.daysLeft} days` : 'Next up on your roadmap',
        }
      : { subject: '', topic: 'All caught up!', reason: 'Add a new subject to continue' }

    const level = Math.floor(student.xp / 100)

    const response: StudyPathResponse = {
      studentId,
      studyPath,
      xp: student.xp,
      level,
      streak: student.streak,
      nextExam,
      todaysFocus,
      badges: [],
    }

    res.json(response)
  } catch (err) {
    if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
      res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND', status: 404 })
      return
    }
    next(err)
  }
})

// GET /api/study-path/:studentId/:subject
// Returns nodes filtered for a specific subject + subject-level metadata
studyPathRouter.get('/:studentId/:subject', async (req, res, next) => {
  try {
    const { studentId, subject } = req.params
    const decodedSubject = decodeURIComponent(subject)

    const student = await readStudentMemory(studentId)
    const memory = student.memory ?? {}
    const studyPath: RoadmapNode[] = memory.studyPath ?? []
    const examDates: { subject: string; date: string }[] = memory.examDates ?? []

    // Find nodes for this subject (case-insensitive)
    const nodes = studyPath.filter(
      n => n.subject.toLowerCase() === decodedSubject.toLowerCase()
    )

    // Find the canonical subject name from the nodes
    const canonicalSubject = nodes[0]?.subject ?? decodedSubject

    // Exam for this subject
    const examEntry = examDates.find(
      e => e.subject.toLowerCase() === decodedSubject.toLowerCase()
    )
    const now = Date.now()
    const nextExam = examEntry
      ? {
          subject: examEntry.subject,
          date: examEntry.date,
          daysLeft: Math.ceil((new Date(examEntry.date).getTime() - now) / 86400000),
        }
      : null

    res.json({
      studentId,
      subject: canonicalSubject,
      nodes,
      xp: student.xp,
      level: Math.floor(student.xp / 100),
      streak: student.streak,
      nextExam,
      badges: [],
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
      res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND', status: 404 })
      return
    }
    next(err)
  }
})
