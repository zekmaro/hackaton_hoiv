# API Contract

**Base URL (dev):** `http://localhost:3001`
**Base URL (prod):** `https://hackatonhoiv-production.up.railway.app`
**All types:** defined in `shared/types.ts` — import from there, never redefine.

This document is the single source of truth between frontend and backend.
If you change an endpoint, update this doc and `shared/types.ts` in the same PR.

---

## Status Overview

| Endpoint | Status |
|---|---|
| `GET /health` | ✅ live |
| `POST /api/onboard/chat` | ✅ live |
| `POST /api/onboard/complete` | ✅ live |
| `POST /api/tutor/add` | ✅ live |
| `POST /api/tutor/message` | ✅ live |
| `GET /api/study-path/:studentId` | ❌ not built |
| `POST /api/tts` | ❌ not built |
| `POST /api/assessment/start` | ❌ not built |

---

## Onboarding (2-step conversational flow)

### Step 1 — POST /api/onboard/chat
One turn of the AI interview. Call repeatedly until `done: true`.

**Request:**
```typescript
{
  name: string
  messages: { role: 'user' | 'assistant', content: string }[]  // full history
}
```

**Response:**
```typescript
{
  reply: string         // show this to the student
  done: boolean         // true when AI has enough info (usually after ~5 exchanges)
  extracted?: ExtractedOnboardData  // only when done: true
}
```

**Frontend flow:**
```
1. Student types first message → POST /api/onboard/chat with messages: []
2. Append reply to messages, student responds → POST again with full history
3. Repeat until done: true
4. Save extracted data, show optional syllabus textarea
5. Call /complete
```

---

### Step 2 — POST /api/onboard/complete
Generates study path, creates student in Postgres. Call once after `done: true`.

**Request:**
```typescript
{
  name: string
  extracted: ExtractedOnboardData   // from /chat when done: true
  syllabus?: string                 // optional pasted syllabus text
}
```

**Response:**
```typescript
{
  studentId: string     // SAVE TO localStorage('studentId') — used in all future calls
  studyPath: RoadmapNode[]
  xp: number
  streak: number
  nextFocus: string
}
```

---

### POST /api/tutor/add
Existing student adds a new subject. Same interview flow as onboarding, different final call.

**Request:**
```typescript
{
  studentId: string         // from localStorage
  extracted: ExtractedOnboardData
  syllabus?: string
}
```

**Response:**
```typescript
{
  studyPath: RoadmapNode[]   // new subject nodes only
  nextFocus: string
}
```

---

## POST /api/tutor/message

Send a message to the AI tutor. Claude autonomously reads memory, teaches, generates problems,
flags gaps, and updates memory — all within a single request.

**Request:**
```typescript
{
  studentId: string
  subject: string               // must match subject name from onboarding exactly
  message: string
  voiceMode: boolean            // false for now (TTS not built)
  sessionHistory: { role: 'user' | 'assistant', content: string }[]  // conversation so far, [] on first message
}
```

**Response:**
```typescript
{
  reply: string                 // tutor's text response — show in chat
  sessionId: string             // not needed for now
  agentActivity: AgentActivity[] // show in agent sidebar
  memoryUpdated: boolean
  xpGained: number              // add to displayed XP total
}
```

**Agent Activity sidebar:** render each item as `[{agent}] {action}`.
Agent values: `"orchestrator"` | `"tutor"` | `"assessment"` | `"memory"`

---

## GET /api/study-path/:studentId

⚠️ NOT BUILT YET. Until live, use `studyPath` stored in localStorage from onboarding.

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
}
```

---

## POST /api/tts

⚠️ NOT BUILT YET.

Convert tutor response text to audio (ElevenLabs).

**Request:**
```typescript
{
  text: string
  voice?: string   // defaults to tutor preset
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

## POST /api/assessment/start

⚠️ NOT BUILT YET — skip for MVP.

---

## Error Format

All errors return:
```typescript
{
  error: string         // human-readable message
  code: string          // machine-readable code
  status: number        // HTTP status code
}
```

**Common codes:**
- `STUDENT_NOT_FOUND` — 404
- `INVALID_SUBJECT` — 400
- `AGENT_ERROR` — 500
- `VALIDATION_ERROR` — 400
