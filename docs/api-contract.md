# API Contract

**Base URL (dev):** `http://localhost:3001`
**All types:** defined in `shared/types.ts` — import from there, never redefine.

This document is the single source of truth between frontend and backend.
If you change an endpoint, update this doc and `shared/types.ts` in the same PR.

---

## POST /api/onboard

Creates a new student, generates their initial study roadmap.

**Request:**
```typescript
{
  name: string
  subjects: string[]            // e.g. ["math", "physics", "history"]
  examDates: {
    subject: string
    date: string                // ISO 8601
  }[]
  goals: string                 // free text, e.g. "get into top university"
  studyHoursPerDay: number
}
```

**Response:**
```typescript
{
  studentId: string
  studyPath: RoadmapNode[]
  xp: number                    // always 0 on first call
  streak: number                // always 0 on first call
  nextFocus: string             // e.g. "Start with Math — exam closest"
}
```

---

## POST /api/tutor/message

Send a message to the AI tutor. Orchestrator routes to correct subject agent.

**Request:**
```typescript
{
  studentId: string
  subject: string               // must match a subject from onboarding
  message: string
  voiceMode: boolean            // if true, response will also be sent to TTS
  sessionId?: string            // optional, continues existing session
}
```

**Response:**
```typescript
{
  reply: string                 // text response from tutor agent
  sessionId: string             // use this for follow-up messages
  agentActivity: AgentActivity[]
  memoryUpdated: boolean
  xpGained: number              // XP earned this message (0-50)
  newBadge?: Badge              // if student earned a badge this message
}
```

---

## GET /api/study-path/:studentId

Returns current study roadmap and gamification state.

**Response:**
```typescript
{
  studentId: string
  studyPath: RoadmapNode[]
  xp: number
  level: number
  streak: number
  nextExam: {
    subject: string
    date: string
    daysLeft: number
  } | null
  todaysFocus: {
    subject: string
    topic: string
    reason: string
  }
  badges: Badge[]
}
```

---

## POST /api/assessment/start

Spawns assessment agent for a specific topic.

**Request:**
```typescript
{
  studentId: string
  subject: string
  topic: string
}
```

**Response:**
```typescript
{
  sessionId: string
  problems: Problem[]
  estimatedMinutes: number
}
```

---

## POST /api/assessment/submit

Submit answers, get evaluation and memory update.

**Request:**
```typescript
{
  sessionId: string
  studentId: string
  answers: {
    problemId: string
    answer: string
  }[]
}
```

**Response:**
```typescript
{
  score: number                 // 0-100
  gaps: string[]                // topics still weak
  feedback: {
    problemId: string
    correct: boolean
    explanation: string
  }[]
  xpGained: number
  memoryUpdated: boolean
  agentActivity: AgentActivity[]
}
```

---

## POST /api/tts

Convert tutor response text to audio (ElevenLabs).

**Request:**
```typescript
{
  text: string
  voice?: string                // defaults to "tutor" voice preset
}
```

**Response:**
```
Content-Type: audio/mpeg
Body: audio binary (ArrayBuffer)
```

**Frontend usage:**
```typescript
const res = await fetch('/api/tts', { method: 'POST', body: JSON.stringify({ text }) })
const blob = await res.blob()
const url = URL.createObjectURL(blob)
new Audio(url).play()
```

---

## GET /api/memory/:studentId

Read full student memory (used by dashboard to show personalized context).

**Response:**
```typescript
{
  studentId: string
  name: string
  subjects: {
    [subject: string]: SubjectMemory
  }
  lastActive: string
  totalSessions: number
}
```

---

## Error Format

All errors return:
```typescript
{
  error: string         // human-readable message
  code: string          // machine-readable code e.g. "STUDENT_NOT_FOUND"
  status: number        // HTTP status code
}
```

**Common codes:**
- `STUDENT_NOT_FOUND` — 404
- `INVALID_SUBJECT` — 400
- `AGENT_ERROR` — 500
- `MEMORY_UNAVAILABLE` — 503 (OpenClaw not running)
