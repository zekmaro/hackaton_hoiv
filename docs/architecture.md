# Architecture

## Hosting

```
Vercel (free)                      Railway Project
└── Frontend (React + TS)          ├── Service 1: Backend (Express + TypeScript)
    VITE_API_URL ───────────────▶  │   URL: hackatonhoiv-production.up.railway.app
                                   │   auto-deploys on push to main
                                   │
                                   └── Service 2: Postgres (addon)
                                       DATABASE_URL auto-injected into backend
```

**Deploy order:** Railway Postgres → Railway Backend → Vercel Frontend

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Person B) — Vercel                   │
│  React 18 + TypeScript + Vite                               │
│                                                             │
│  /              → Landing page                             │
│  /onboarding    → Conversational AI interview              │
│  /dashboard     → Subject cards, XP, streak                │
│  /tutor/:subject → Chat + Agent Activity sidebar           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS — VITE_API_URL
┌───────────────────────▼─────────────────────────────────────┐
│           BACKEND (Person A) — Railway                      │
│  Node.js + Express + TypeScript                             │
│                                                             │
│  POST /api/onboard/chat      → AI interview (Haiku)        │
│  POST /api/onboard/complete  → create student + study path  │
│  POST /api/tutor/add         → add subject to student       │
│  POST /api/tutor/message     → agentic tutor session        │
│  GET  /api/study-path/:id    → roadmap + XP (not built)    │
│  POST /api/tts               → ElevenLabs TTS (not built)  │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐
│    Claude API        │   │  Postgres (Railway)  │
│    Anthropic SDK     │   │                      │
│                      │   │  students table:     │
│  Onboarding: Haiku   │   │  - id (UUID)         │
│  Tutor: Sonnet 4.6   │   │  - name              │
│  Study path: Sonnet  │   │  - memory (JSONB)    │
│                      │   │  - xp                │
└──────────────────────┘   │  - streak            │
                           │  - last_active       │
                           └──────────────────────┘
```

---

## Memory Architecture

Student memory lives in a **Postgres JSONB column**. The agentic tutor reads it via tool call
at the start of every session, and writes updates back via tool call after every response.

```typescript
// memory JSONB structure per student:
{
  subjects: {
    "Calculus 1": {
      weak: ["integration by parts", "limits"],
      strong: ["algebra", "derivatives"],
      gaps: ["chain rule"],
      lastSession: "2026-03-27T21:44:00.000Z",
      sessionsCount: 5,
      lastNote: "Student understood derivatives but struggled with chain rule"
    },
    "Physics - Mechanics": { ... }
  },
  examDates: [{ subject: "Calculus 1", date: "2026-04-17" }],
  goals: "Pass finals",
  learningStyle: "examples",
  studyPath: RoadmapNode[]
}
```

---

## Agent Architecture (Actual Implementation)

### Onboarding Agent — `backend/src/agents/orchestrator.ts`
- **Model:** claude-haiku-4-5
- **Role:** Conversational interview. Asks 5 questions, extracts structured data.
- **Completion signal:** Claude outputs `READY:{...json...}` → backend parses it
- **Study path generation:** Separate Sonnet call after interview extracts `ExtractedOnboardData`

### Agentic Tutor Loop — `backend/src/agents/tutors/index.ts`
- **Model:** claude-sonnet-4-6
- **How it works:** Claude runs in a `while(true)` loop, calling tools autonomously until `stop_reason === 'end_turn'`
- **No hardcoded routing** — Claude decides what to do on every message

**Tools Claude can call (defined in `backend/src/agents/tools.ts`):**

| Tool | What it does |
|---|---|
| `read_student_memory` | Reads subject history, weak/strong topics, exam date from Postgres |
| `generate_practice_problem` | Returns problem spec → Claude formulates the actual question |
| `update_student_memory` | Saves session progress + XP to Postgres (called after EVERY response) |
| `flag_knowledge_gap` | Writes gap to student memory for future focus |
| `unlock_next_node` | Marks topic completed, unlocks next roadmap node |

**Typical tool call sequence per message:**
```
orchestrator: Routing to [subject] tutor...
  → read_student_memory      (memory: Reading history...)
  → [Claude generates response + optional tool calls]
  → generate_practice_problem (if student needs practice)
  → flag_knowledge_gap        (if gap detected)
  → unlock_next_node          (if mastery demonstrated)
  → update_student_memory     (ALWAYS — saves XP + session note)
tutor: Response ready.
```

---

## Voice Pipeline

```
User speaks
  → Web Speech API (browser native, free, no backend needed)
  → transcript string
  → POST /api/tutor/message { message: transcript, voiceMode: true }
  → Claude response text
  → POST /api/tts (ElevenLabs) ← NOT BUILT YET
  → audio/mpeg blob
  → browser plays audio
```

**STT:** handled entirely in browser (Web Speech API) — no backend involvement.
**TTS:** `POST /api/tts` not built yet. For demo: skip audio playback, show text only.

---

## Data Flow: Full User Journey

```
1. POST /api/onboard/chat  (repeated until done: true)
   → Haiku runs interview
   → Returns { reply, done, extracted? }

2. POST /api/onboard/complete
   → Sonnet generates RoadmapNode[]
   → Student record created in Postgres
   → Returns { studentId, studyPath, xp: 0, streak: 0 }
   → Frontend saves studentId to localStorage

3. POST /api/tutor/message  (every chat message)
   → Claude reads memory via tool call
   → Claude teaches, generates problems, flags gaps
   → Claude updates memory + XP via tool call
   → Returns { reply, agentActivity[], xpGained, memoryUpdated }

4. GET /api/study-path/:studentId  ← NOT BUILT YET
   → Read Postgres → calculate priorities by exam proximity
   → Returns StudyPathResponse (roadmap + XP + streak)

5. POST /api/tts  ← NOT BUILT YET
   → ElevenLabs converts reply to audio
   → Returns audio/mpeg
```

---

## Agent Activity (visible in UI)

Every `/api/tutor/message` response includes `agentActivity[]` — show in the sidebar.
This makes the multi-agent system visible to judges.

```typescript
[
  { agent: 'orchestrator', action: 'Routing message to Physics tutor agent...', timestamp },
  { agent: 'memory',       action: 'Reading Physics history for student...', timestamp },
  { agent: 'tutor',        action: 'Generating medium problem on Newton\'s Second Law...', timestamp },
  { agent: 'assessment',   action: 'Gap detected in F=ma (major) — flagging...', timestamp },
  { agent: 'memory',       action: 'Saving session progress — XP +20...', timestamp },
  { agent: 'tutor',        action: 'Response ready.', timestamp },
]
```
