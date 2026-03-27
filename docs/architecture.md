# Architecture

## Hosting

```
Vercel (free)                      Railway Project
└── Frontend (React + TS)          ├── Service 1: Backend (Express)
    VITE_API_URL ───────────────▶  │   auto-deploys on push to main
                                   │   URL: backend-xxx.up.railway.app
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
│  /onboarding    → Multi-step form (name, subjects, exams)  │
│  /dashboard     → Study roadmap, XP, streak, next session  │
│  /tutor/:subject → Voice/chat AI tutor per subject         │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS — VITE_API_URL
┌───────────────────────▼─────────────────────────────────────┐
│           BACKEND (Person A) — Railway                      │
│  Node.js + Express + TypeScript                             │
│                                                             │
│  POST /api/onboard         → create student + study path   │
│  POST /api/tutor/message   → route to subject tutor agent  │
│  GET  /api/study-path/:id  → roadmap + XP + streak         │
│  POST /api/assessment/*    → spawn assessment agent         │
│  GET  /api/memory/:id      → read student memory           │
│  POST /api/tts             → ElevenLabs text-to-speech     │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐
│    Claude API        │   │  Postgres (Railway)  │
│    Anthropic SDK     │   │                      │
│    claude-sonnet-4-6 │   │  students table:     │
│                      │   │  - id                │
│  Agents:             │   │  - name              │
│  - Orchestrator      │   │  - memory (JSONB)    │
│  - Subject Tutors    │   │  - xp                │
│  - Assessment        │   │  - streak            │
│  - Study Path Gen    │   │  - last_active       │
└──────────────────────┘   └──────────────────────┘
```

---

## Memory Architecture

Student memory lives in a **Postgres JSONB column**. Before every Claude call, we read it
and inject it into the system prompt. After every session, we write updates back.

```typescript
// memory JSONB structure per student:
{
  math: {
    weak: ["integration by parts", "limits"],
    strong: ["algebra", "derivatives"],
    lastSession: "2026-03-27",
    sessionsCount: 5,
    averageScore: 72
  },
  physics: { ... },
  // one key per subject
}
```

**How the tutor "remembers":**
```
1. Student sends message
2. Backend reads memory from Postgres
3. Memory injected into Claude system prompt:
   "Student previously struggled with: integration by parts.
    Last session score: 72%. Focus on gaps."
4. Claude responds as if it remembers everything
5. After response → write session update back to Postgres
```

---

## Agent Architecture

### Orchestrator Agent
**Role:** Entry point. Reads memory, picks which subject tutor to activate, injects context.

**System prompt:** `backend/prompts/orchestrator.ts`

**Tools (Claude tool_use):**
- `read_memory` → reads Postgres student record
- `update_study_path` → recalculates roadmap priorities
- `spawn_tutor` → activates subject-specific agent with context

---

### Subject Tutor Agents (spawned per subject)
**Role:** Subject expert with injected student history.

**System prompts:** `backend/prompts/tutors/[subject].ts`

**Tools:**
- `generate_problem(topic, difficulty)` → practice problem
- `evaluate_answer(problem, answer)` → check + explain
- `update_memory(subject, update)` → writes to Postgres
- `flag_gap(topic)` → triggers Assessment Agent

---

### Assessment Agent
**Role:** Detects knowledge gaps, generates targeted problems, evaluates, reports back.

**Spawned by:** Subject Tutor when gap detected

**Flow:**
```
Tutor flags gap → Assessment generates 2-3 problems
→ Student answers → Assessment evaluates
→ Writes gap to memory → Tutor adapts
```

---

## Voice Pipeline

```
User speaks
  → Web Speech API (browser native, free)
  → transcript → POST /api/tutor/message { voiceMode: true }
  → Claude response text
  → POST /api/tts (ElevenLabs)
  → audio/mpeg blob
  → browser plays audio
```

**Latency target:** under 3 seconds end-to-end

---

## Agent Activity (visible in UI)

Every agent response includes `agentActivity[]` — shown in the sidebar during sessions.
This makes the multi-agent system visible to judges.

```typescript
[
  { agent: 'orchestrator', action: 'Reading student memory...', timestamp },
  { agent: 'orchestrator', action: 'Exam in 3 days → Math Tutor activated', timestamp },
  { agent: 'tutor',        action: 'Gap detected in integration by parts', timestamp },
  { agent: 'assessment',   action: 'Generating 2 targeted problems', timestamp },
  { agent: 'memory',       action: 'Session logged, XP +40', timestamp },
]
```

---

## Data Flow: First Session

```
1. POST /api/onboard
   → Orchestrator generates RoadmapNode[] via Claude
   → Student record created in Postgres
   → Response: { studentId, studyPath, xp: 0, streak: 0 }

2. GET /api/study-path/:studentId
   → Read Postgres → calculate priorities by exam proximity
   → Response: StudyPathResponse

3. POST /api/tutor/message
   → Read memory from Postgres
   → Orchestrator → Subject Tutor Agent (with memory injected)
   → Claude response + agentActivity[]
   → Write session update to Postgres
   → Response: TutorMessageResponse

4. POST /api/tts
   → ElevenLabs converts reply to audio
   → Returns audio/mpeg
```
