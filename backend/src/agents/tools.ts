import type Anthropic from '@anthropic-ai/sdk'
import { readStudentMemory, updateSubjectMemory, updateXPAndStreak } from '../memory/client'

// ─── Tool Definitions (given to Claude) ──────────────────────────────────────
// Claude reads these and decides when to call each one.

export const tutorTools: Anthropic.Tool[] = [
  {
    name: 'read_student_memory',
    description: 'Read the student\'s full learning history for this subject — past sessions, weak topics, strong topics, score history, and exam date. Call this first at the start of every session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        studentId: { type: 'string', description: 'The student UUID' },
        subject: { type: 'string', description: 'Subject name e.g. "Calculus 1"' },
      },
      required: ['studentId', 'subject'],
    },
  },
  {
    name: 'generate_practice_problem',
    description: 'Generate a practice problem on a specific topic. Use when student needs to test understanding or when you want to check for gaps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: { type: 'string', description: 'Specific topic e.g. "chain rule with trig functions"' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Problem difficulty' },
        learningStyle: { type: 'string', enum: ['examples', 'theory', 'mixed'], description: 'Student\'s preferred style' },
      },
      required: ['topic', 'difficulty'],
    },
  },
  {
    name: 'update_student_memory',
    description: 'Save what happened in this session — what was covered, mistakes made, topics mastered. Always call this at the end of a meaningful interaction.',
    input_schema: {
      type: 'object' as const,
      properties: {
        studentId: { type: 'string' },
        subject: { type: 'string' },
        weakTopics: { type: 'array', items: { type: 'string' }, description: 'Topics student struggled with' },
        strongTopics: { type: 'array', items: { type: 'string' }, description: 'Topics student demonstrated understanding of' },
        xpGained: { type: 'number', description: 'XP to award, 10-50 based on engagement' },
        sessionNote: { type: 'string', description: 'Brief note about this session for future reference' },
      },
      required: ['studentId', 'subject', 'weakTopics', 'strongTopics', 'xpGained'],
    },
  },
  {
    name: 'flag_knowledge_gap',
    description: 'Flag a specific knowledge gap when student repeatedly struggles with the same concept. This triggers focused remediation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        studentId: { type: 'string' },
        subject: { type: 'string' },
        gapTopic: { type: 'string', description: 'The specific topic where the gap exists' },
        severity: { type: 'string', enum: ['minor', 'major'], description: 'How serious is the gap' },
      },
      required: ['studentId', 'subject', 'gapTopic', 'severity'],
    },
  },
  {
    name: 'unlock_next_node',
    description: 'Unlock the next topic in the student\'s study path when they have demonstrated mastery of the current topic.',
    input_schema: {
      type: 'object' as const,
      properties: {
        studentId: { type: 'string' },
        subject: { type: 'string' },
        masteredTopic: { type: 'string', description: 'The topic the student just mastered' },
      },
      required: ['studentId', 'subject', 'masteredTopic'],
    },
  },
]

// ─── Tool Executor ────────────────────────────────────────────────────────────
// Runs the actual function when Claude decides to call a tool.

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  addActivity: (agent: string, action: string) => void,
): Promise<string> {
  switch (toolName) {
    case 'read_student_memory': {
      addActivity('memory', `Reading ${input.subject} history for student...`)
      const student = await readStudentMemory(input.studentId as string)
      const subjectMemory = student.memory?.subjects?.[input.subject as string] ?? {}
      return JSON.stringify({
        name: student.name,
        subject: input.subject,
        memory: subjectMemory,
        xp: student.xp,
        streak: student.streak,
        examDates: student.memory?.examDates ?? [],
        goals: student.memory?.goals ?? '',
        learningStyle: student.memory?.learningStyle ?? 'mixed',
      })
    }

    case 'generate_practice_problem': {
      addActivity('tutor', `Generating ${input.difficulty} problem on ${input.topic}...`)
      // Return a structured problem prompt — Claude will use this to formulate the actual question
      return JSON.stringify({
        instruction: `Generate a ${input.difficulty} ${input.learningStyle === 'examples' ? 'worked-example style' : ''} problem on: ${input.topic}. Show step-by-step solution after student attempts.`,
        topic: input.topic,
        difficulty: input.difficulty,
      })
    }

    case 'update_student_memory': {
      addActivity('memory', `Saving session progress — XP +${input.xpGained}...`)
      const { studentId, subject, weakTopics, strongTopics, xpGained, sessionNote } = input as {
        studentId: string
        subject: string
        weakTopics: string[]
        strongTopics: string[]
        xpGained: number
        sessionNote?: string
      }

      const student = await readStudentMemory(studentId)
      const existing = student.memory?.subjects?.[subject] ?? {}

      // Merge weak/strong — remove from weak if now strong
      const mergedWeak = [...new Set([...(existing.weak ?? []), ...weakTopics])]
        .filter(t => !strongTopics.includes(t))
      const mergedStrong = [...new Set([...(existing.strong ?? []), ...strongTopics])]

      await updateSubjectMemory(studentId, subject, {
        ...existing,
        weak: mergedWeak,
        strong: mergedStrong,
        lastSession: new Date().toISOString(),
        sessionsCount: (existing.sessionsCount ?? 0) + 1,
        lastNote: sessionNote ?? '',
      })

      await updateXPAndStreak(studentId, xpGained)
      return JSON.stringify({ success: true, xpGained, message: 'Memory updated successfully' })
    }

    case 'flag_knowledge_gap': {
      addActivity('assessment', `Gap detected in ${input.gapTopic} (${input.severity}) — flagging for remediation...`)
      const student = await readStudentMemory(input.studentId as string)
      const existing = student.memory?.subjects?.[input.subject as string] ?? {}
      const gaps = existing.gaps ?? []
      if (!gaps.includes(input.gapTopic)) gaps.push(input.gapTopic)
      await updateSubjectMemory(input.studentId as string, input.subject as string, { ...existing, gaps })
      return JSON.stringify({ success: true, message: `Gap flagged: ${input.gapTopic}` })
    }

    case 'unlock_next_node': {
      addActivity('orchestrator', `Mastery detected in ${input.masteredTopic} — unlocking next topic...`)
      const student = await readStudentMemory(input.studentId as string)
      const studyPath = student.memory?.studyPath ?? []

      // Find next locked node for this subject and unlock it
      const masteredIndex = studyPath.findIndex(
        (n: { subject: string; topic: string; status: string }) =>
          n.subject === input.subject && n.topic === input.masteredTopic,
      )
      if (masteredIndex !== -1 && studyPath[masteredIndex + 1]) {
        studyPath[masteredIndex].status = 'completed'
        studyPath[masteredIndex + 1].status = 'available'
        await updateSubjectMemory(input.studentId as string, '__studyPath__', studyPath)
      }
      return JSON.stringify({ success: true, message: `Next topic unlocked after ${input.masteredTopic}` })
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}
