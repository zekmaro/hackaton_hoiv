import { Pool } from 'pg'

// Memory Client — Postgres via Railway
// All agents read/write student state through these functions.
// Never query the DB directly from routes — always use this client.
// DATABASE_URL is auto-injected by Railway when Postgres addon is added.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Run once on startup to create tables if they don't exist
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      memory JSONB NOT NULL DEFAULT '{}',
      xp INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function readStudentMemory(studentId: string) {
  const res = await pool.query('SELECT * FROM students WHERE id = $1', [studentId])
  if (res.rows.length === 0) throw new Error('STUDENT_NOT_FOUND')
  return res.rows[0]
}

export async function createStudentMemory(studentId: string, data: {
  name: string
  memory: object
}) {
  await pool.query(
    'INSERT INTO students (id, name, memory) VALUES ($1, $2, $3)',
    [studentId, data.name, JSON.stringify(data.memory)]
  )
}

export async function updateSubjectMemory(studentId: string, subject: string, update: object) {
  // Merge update into the subject key inside the memory JSONB column
  await pool.query(
    `UPDATE students
     SET memory = jsonb_set(memory, $1, $2, true),
         last_active = NOW()
     WHERE id = $3`,
    [`{"${subject.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"}`, JSON.stringify(update), studentId]
  )
}

export async function mergeStudyPath(studentId: string, studyPath: object[]) {
  await pool.query(
    `UPDATE students
     SET memory = jsonb_set(memory, '{studyPath}', $1::jsonb, true),
         last_active = NOW()
     WHERE id = $2`,
    [JSON.stringify(studyPath), studentId]
  )
}

export async function updateXPAndStreak(studentId: string, xpGained: number) {
  await pool.query(
    `UPDATE students
     SET xp = xp + $1,
         streak = streak + 1,
         last_active = NOW()
     WHERE id = $2`,
    [xpGained, studentId]
  )
}
