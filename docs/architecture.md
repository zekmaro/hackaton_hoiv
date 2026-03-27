# Architecture

## Hosting

```
Vercel (free)                     Railway Project
└── Frontend (React + TS)         ├── Service 1: OpenClaw
    VITE_API_URL ──────────────▶  │   (official template, one-click)
                                  │   Persistent volume: /data
                                  │   URL: openclaw-xxx.up.railway.app
                                  │
                                  └── Service 2: Backend (Express)
                                      OPENCLAW_URL → Service 1
                                      URL: backend-xxx.up.railway.app
```

**Deploy order:** OpenClaw → Backend → Frontend

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
│           BACKEND (Person A) — Railway Service 2            │
│  Node.js + Express + TypeScript                             │
│                                                             │
│  /api/onboard          → creates student, generates roadmap │
│  /api/tutor/message    → routes to correct tutor agent      │
│  /api/study-path/:id   → returns current roadmap + XP      │
│  /api/assessment/*     → spawns assessment agent            │
│  /api/memory/:id       → reads student memory from OpenClaw │
│  /api/tts              → ElevenLabs text-to-speech          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴──────────────────┐
        │                                  │
┌───────▼────────┐                ┌────────▼──────────────────┐
│  Claude API    │                │  OpenClaw — Railway Svc 1 │
│  (Anthropic)   │                │  (official Railway template│
│                │                │   one-click deploy)        │
│  claude-sonnet-4-6     │                │                           │
│                │                │  Persistent memory: /data  │
│  Agents:       │                │  WebSocket control plane   │
│  - Orchestrator│                │                           │
│  - MathTutor   │                │  Skills:                  │
│  - PhysicsTutor│                │  - StudyPath              │
│  - Assessment  │                │  - ExamReminder           │
│  - StudyPath   │                │  - SessionLog             │
└────────────────┘                │                           │
                                  │  Cron jobs →              │
                                  │  Telegram reminders       │
                                  └───────────────────────────┘
```

---

## Agent Architecture

### Orchestrator Agent
**Role:** Entry point for every student interaction. Reads memory, decides which tutor to activate, routes the message.

**Input:** student message + studentId
**Output:** routes to subject tutor agent with context injected

**System prompt location:** `backend/prompts/orchestrator.ts`

**Tools available:**
- `read_memory(studentId)` → gets full student profile from OpenClaw
- `update_study_path(studentId, updates)` → adjusts roadmap
- `spawn_tutor(subject, context)` → activates subject-specific agent
- `get_exam_priority(studentId)` → returns nearest exam + recommended focus

---

### Subject Tutor Agents (one per subject, spawned on demand)
**Role:** Subject expert that knows the student's history in that subject.

**Subjects:** math, physics, chemistry, biology, history, literature, cs (expandable)

**Input:** message + injected student memory for that subject
**Output:** explanation / problem / encouragement + memory update payload

**System prompt location:** `backend/prompts/tutors/[subject].ts`

**Tools available:**
- `generate_problem(topic, difficulty)` → creates practice problem
- `evaluate_answer(problem, answer)` → checks and explains
- `update_memory(studentId, subject, update)` → logs session data
- `spawn_assessment(topic)` → triggers focused assessment session

---

### Assessment Agent
**Role:** Detects knowledge gaps, generates targeted problems, evaluates and reports back.

**Spawned by:** Subject Tutor when it detects repeated mistakes

**System prompt location:** `backend/prompts/assessment.ts`

**Flow:**
```
Subject Tutor detects gap
  → spawns Assessment Agent with topic
  → Assessment generates 2-3 focused problems
  → Student answers
  → Assessment evaluates + finds root gap
  → Reports to Subject Tutor
  → Tutor adapts explanation
  → Memory updated with gap + resolution
```

---

### Memory Agent (OpenClaw)
**Role:** Single source of truth for student learning state. All agents read and write through this.

**What it stores per student:**
```typescript
{
  studentId: string
  name: string
  subjects: {
    [subject: string]: {
      weak: string[]        // topics that need work
      strong: string[]      // mastered topics
      lastSession: Date
      sessionsCount: number
      averageScore: number
    }
  }
  studyPath: RoadmapNode[]
  xp: number
  streak: number
  lastActive: Date
  examDates: { subject: string; date: Date }[]
  preferredStudyTime: string
  pace: 'slow' | 'medium' | 'fast'
}
```

---

## Voice Pipeline

```
User speaks
  → Web Speech API (browser, free, no setup)
  → transcript string sent to POST /api/tutor/message
  → Orchestrator → Subject Tutor Agent
  → Claude response text
  → POST /api/tts (ElevenLabs)
  → audio blob returned
  → browser plays audio
```

**Latency target:** under 3 seconds end-to-end for demo

---

## Data Flow: First Session

```
1. User fills onboarding form
   POST /api/onboard { name, subjects, examDates, goals }

2. Backend: Orchestrator Agent generates initial study path
   Claude call with structured output → RoadmapNode[]

3. OpenClaw: creates student memory record

4. Backend responds: { studentId, studyPath, xp: 0, streak: 0 }

5. Frontend: shows animated dashboard with roadmap

6. User taps subject → opens tutor
   POST /api/tutor/message { studentId, subject, message, voiceMode }

7. Backend: Orchestrator reads memory → spawns Subject Tutor Agent
   Agent has full context injected

8. Response: { reply, agentActivity[], memoryUpdated }

9. Frontend: shows reply (text + voice), shows agent activity sidebar

10. OpenClaw: cron job scheduled for exam reminder via Telegram
```

---

## Agent Activity Sidebar (Frontend Component)

The frontend shows live agent reasoning as events stream in.
Backend sends `agentActivity[]` with each response:

```typescript
type AgentActivity = {
  agent: 'orchestrator' | 'tutor' | 'assessment' | 'memory'
  action: string   // human-readable description
  timestamp: Date
}

// Example:
[
  { agent: 'orchestrator', action: 'Reading Ana\'s memory...', timestamp },
  { agent: 'orchestrator', action: 'Exam in 3 days → activating Math Tutor', timestamp },
  { agent: 'tutor',        action: 'Detected gap in integration by parts', timestamp },
  { agent: 'assessment',   action: 'Generating 2 targeted problems', timestamp },
  { agent: 'memory',       action: 'Session logged, streak updated', timestamp },
]
```

This makes the agentic system **visible** to judges during the demo.
