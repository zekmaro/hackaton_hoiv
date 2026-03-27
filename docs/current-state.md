# Current State

Last updated: 2026-03-27

---

## What Is Built and Working

### Backend (deployed at https://hackatonhoiv-production.up.railway.app)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /health` | ✅ done | returns `{ status: ok, version: 2 }` |
| `POST /api/onboard/chat` | ✅ done | conversational AI interview, Haiku model |
| `POST /api/onboard/complete` | ✅ done | generates study path via Claude Sonnet, saves to Postgres |
| `POST /api/tutor/message` | ❌ not started | next priority |
| `GET /api/study-path/:studentId` | ❌ not started | needed for dashboard |
| `POST /api/assessment/start` | ❌ not started | later |
| `POST /api/assessment/submit` | ❌ not started | later |
| `GET /api/memory/:studentId` | ❌ not started | later |
| `POST /api/tts` | ❌ not started | voice feature, later |

### Frontend
- Project structure scaffolded, all pages stubbed
- NOT connected to backend yet
- No actual UI implemented beyond shell components

### Infrastructure
- Railway backend: live at https://hackatonhoiv-production.up.railway.app
- Railway Postgres: connected, `students` table auto-created on startup
- Vercel: not set up yet (Person B does this)

---

## Onboarding Flow (how it works)

Two-step conversational flow — no forms:

**Step 1: `/api/onboard/chat` (call repeatedly)**
```typescript
// Frontend sends growing message history each turn
// Backend responds with AI reply + done: boolean
// When done: true → extracted data is returned

// Example extracted data:
{
  subjects: [{ name: "Calculus 1", level: "university", currentStruggles: "Chain rule" }],
  goals: "Get a B+ grade",
  examDates: [{ subject: "Calculus 1", date: "2026-04-17" }],
  studyHoursPerDay: 3,
  learningStyle: "examples"
}
```

**Step 2: `/api/onboard/complete` (call once after done: true)**
```typescript
// Send: { name, extracted, syllabus? }
// Returns: { studentId, studyPath, xp: 0, streak: 0, nextFocus }
// Frontend: save studentId to localStorage, redirect to /dashboard
```

---

## Student Memory Structure (Postgres)

```typescript
// students table row:
{
  id: string,           // UUID, the studentId
  name: string,
  xp: number,           // starts at 0
  streak: number,       // starts at 0
  last_active: Date,
  memory: {             // JSONB column
    subjects: {
      "Calculus 1": {
        weak: ["chain rule"],    // updated after each session
        strong: [],
        level: "university",
        lastSession: null,
        sessionsCount: 0,
        averageScore: 0
      }
    },
    examDates: [{ subject: "Calculus 1", date: "2026-04-17" }],
    goals: "Get a B+ grade",
    learningStyle: "examples",
    studyHoursPerDay: 3,
    studyPath: RoadmapNode[],   // full roadmap stored here
    syllabus: null              // or pasted syllabus text
  }
}
```

---

## What Frontend Needs to Build Next (Person B)

**Priority 1 — Onboarding page (`/onboarding`)**
- Name input → then chat interface (NOT a form)
- Each user message → POST `/api/onboard/chat` with full message history
- Show AI reply, keep conversation going
- When `done: true` → show syllabus textarea (optional)
- Submit → POST `/api/onboard/complete` → save studentId → redirect to `/dashboard`

**Priority 2 — Dashboard (`/dashboard`)**
- GET `/api/study-path/:studentId` (not built yet — Person A building this)
- Show roadmap nodes, XP, streak, today's focus
- Each subject node → navigates to `/tutor/:subject`

**Priority 3 — Tutor page (`/tutor/:subject`)**
- Chat interface + voice mic button
- POST `/api/tutor/message` (Person A building this next)
- Agent activity sidebar (shows what agents are doing)

---

## What Backend Needs to Build Next (Person A)

**Priority 1 — `POST /api/tutor/message`**
- Read student memory from Postgres
- Orchestrator (Haiku) decides context to inject
- Subject tutor agent (Sonnet) generates response
- Update memory after session
- Return: `{ reply, sessionId, agentActivity[], xpGained, memoryUpdated }`

**Priority 2 — `GET /api/study-path/:studentId`**
- Read student from Postgres
- Return full StudyPathResponse (roadmap + XP + streak + next exam)

**Priority 3 — `POST /api/tts`**
- ElevenLabs or browser TTS for voice responses
- Returns audio/mpeg

---

## Models Used

| Agent | Model | Why |
|---|---|---|
| Onboard interview | `claude-haiku-4-5-20251001` | fast chat turns |
| Study path generation | `claude-sonnet-4-6` | quality structured output |
| Tutor agent | `claude-sonnet-4-6` | core UX, must be smart |
| Orchestrator routing | `claude-haiku-4-5-20251001` | simple routing task |

---

## Sync Points for Both People

| When | What |
|---|---|
| Now | Person B pulls main, starts onboarding chat UI |
| Person A builds `/api/study-path` | Person B connects dashboard |
| Person A builds `/api/tutor/message` | Person B connects tutor chat |
| Person A builds `/api/tts` | Person B adds voice playback |
