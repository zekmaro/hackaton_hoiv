import axios from 'axios'
// import { StudentMemory, SubjectMemory } from '../../../../shared/types'

const OPENCLAW_URL = process.env.OPENCLAW_URL
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN

// OpenClaw Memory Client
// All agents read/write student state through these functions.
// Never call OpenClaw directly from routes — always use this client.

function headers() {
  return { Authorization: `Bearer ${OPENCLAW_TOKEN}` }
}

export async function readStudentMemory(_studentId: string) {
  // TODO: implement
  // Call OpenClaw memory API to retrieve student profile
  throw new Error('readStudentMemory not implemented yet')
}

export async function createStudentMemory(_studentId: string, _data: unknown) {
  // TODO: implement
  // Create initial student record in OpenClaw after onboarding
  throw new Error('createStudentMemory not implemented yet')
}

export async function updateSubjectMemory(_studentId: string, _subject: string, _update: unknown) {
  // TODO: implement
  // Called after each tutor session to update weak/strong topics, score, etc.
  throw new Error('updateSubjectMemory not implemented yet')
}

export async function updateXPAndStreak(_studentId: string, _xpGained: number) {
  // TODO: implement
  throw new Error('updateXPAndStreak not implemented yet')
}
