# Current State

Last updated: 2026-03-27 (evening)

---

## Backend — What Is Live

**Deployed at:** https://hackatonhoiv-production.up.railway.app

| Endpoint | Status | Notes |
|---|---|---|
| `GET /health` | ✅ live | `{ status: ok, version: 2 }` |
| `POST /api/onboard/chat` | ✅ live | conversational interview, Haiku |
| `POST /api/onboard/complete` | ✅ live | creates student + study path in Postgres |
| `POST /api/tutor/add` | ✅ live | adds new subject to existing student |
| `POST /api/tutor/message` | ✅ live | **agentic tutor** — Claude tool use loop |
| `GET /api/study-path/:studentId` | ❌ not built | needed for dashboard cards |
| `POST /api/tts` | ❌ not built | voice feature |
| `POST /api/assessment/start` | ❌ not built | later |

---

## How The Tutor Agent Works (important for frontend)

The tutor is a **real AI agent** — Claude decides what tools to call on every message.
Frontend does NOT need to manage this logic. Just send the message, render the response.

**What happens on every `POST /api/tutor/message`:**
```
1. Claude reads student memory from DB (automatically)
2. Claude decides teaching strategy based on history
3. Claude generates response + optionally calls tools:
   - generate_practice_problem()  → creates a practice question
   - flag_knowledge_gap()         → detects repeated mistakes
   - unlock_next_node()           → unlocks next roadmap topic on mastery
   - update_student_memory()      → saves session progress + XP
4. Returns reply + agentActivity[] showing what Claude decided
```

**The `agentActivity[]` array is what you show in the sidebar.**
Each item: `{ agent: "orchestrator"|"tutor"|"assessment"|"memory", action: string, timestamp }`

---

## API Reference for Frontend

### POST /api/onboard/chat
```typescript
// Request — send on every student message during interview
{
  name: string,
  messages: { role: "user" | "assistant", content: string }[]  // full history
}

// Response
{
  reply: string,      // show this as AI message
  done: boolean,      // when true → stop interview, show syllabus step
  extracted?: {       // only when done: true
    subjects: { name: string, level: string, currentStruggles: string }[],
    goals: string,
    examDates: { subject: string, date: string }[],
    studyHoursPerDay: number,
    learningStyle: "examples" | "theory" | "mixed"
  }
}
```

### POST /api/onboard/complete
```typescript
// Request — call once after done: true
{
  name: string,
  extracted: ExtractedOnboardData,  // from /chat response
  syllabus?: string                 // optional pasted text
}

// Response
{
  studentId: string,      // ← SAVE THIS to localStorage
  studyPath: RoadmapNode[],
  xp: 0,
  streak: 0,
  nextFocus: string
}
```

### POST /api/tutor/add
```typescript
// Request — when existing student adds a new subject
// (same extracted data as /complete but with studentId instead of creating new)
{
  studentId: string,        // from localStorage
  extracted: ExtractedOnboardData,
  syllabus?: string
}

// Response
{
  studyPath: RoadmapNode[], // new subject nodes only
  nextFocus: string
}
```

### POST /api/tutor/message
```typescript
// Request
{
  studentId: string,        // from localStorage
  subject: string,          // e.g. "Calculus 1" — must match subject name from onboarding
  message: string,          // what student typed or said
  voiceMode: boolean,       // false for now, true when TTS is ready
  sessionHistory: { role: "user" | "assistant", content: string }[]  // conversation so far
}

// Response
{
  reply: string,            // tutor's response — show this in chat
  sessionId: string,        // not needed for now
  agentActivity: {          // show these in the agent sidebar
    agent: "orchestrator" | "tutor" | "assessment" | "memory",
    action: string,
    timestamp: string
  }[],
  memoryUpdated: boolean,
  xpGained: number          // add this to displayed XP
}
```

---

## Onboarding Page Logic

```typescript
// /onboarding page — check if new student or adding subject
const studentId = localStorage.getItem('studentId')

if (!studentId) {
  // NEW STUDENT
  // Step 1: show name input
  // Step 2: chat loop calling POST /api/onboard/chat
  // Step 3: when done: true → show syllabus textarea
  // Step 4: POST /api/onboard/complete → save studentId → redirect /dashboard
} else {
  // EXISTING STUDENT ADDING A SUBJECT
  // Skip name step (already known)
  // Same chat loop calling POST /api/onboard/chat
  // When done: true → POST /api/tutor/add → redirect /dashboard
}
```

---

## Dashboard Mental Model

Dashboard = **grid of tutor cards**, one per subject the student has added.

```
┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐
│ 📐 Calculus 1       │  │ ⚡ Physics           │  │  + Add new   │
│ University          │  │ University           │  │    subject   │
│ Exam: Apr 17        │  │ Exam: Apr 10         │  │              │
│ Progress: 2/8 nodes │  │ Progress: 0/8 nodes  │  │              │
│ [ Open tutor → ]    │  │ [ Open tutor → ]     │  │              │
└─────────────────────┘  └─────────────────────┘  └──────────────┘
```

- Each card → navigates to `/tutor/[subject-name]`
- `+ Add new subject` → navigates to `/onboarding`
- Data for cards comes from `GET /api/study-path/:studentId` (not built yet)
- Until that endpoint is ready → store studyPath from onboarding response in localStorage

---

## Tutor Page Layout

```
┌──────────────────────────────┬─────────────────────┐
│  Chat area                   │  Agent Activity      │
│                              │                      │
│  [AI]: Hey Marco! I read     │  [orchestrator]      │
│  your history...             │  Routing to tutor... │
│                              │                      │
│  [You]: explain newton       │  [memory]            │
│                              │  Reading history...  │
│  [AI]: F = ma, here's        │                      │
│  an example...               │  [tutor]             │
│                              │  Generating problem  │
│                              │                      │
├──────────────────────────────┴─────────────────────┤
│  [mic 🎤]  Type your message...          [Send →]  │
└────────────────────────────────────────────────────┘
```

- Send message → POST `/api/tutor/message` with full `sessionHistory`
- Append AI reply to chat
- Append `agentActivity[]` items to sidebar
- Add `xpGained` to running XP total

---

## localStorage Keys

```typescript
'studentId'     → string UUID (set after onboarding)
'studentName'   → string (set after onboarding, for display)
'theme'         → 'light' | 'dark'
'studyPath'     → JSON string of RoadmapNode[] (cache until /api/study-path is ready)
```

---

## What Backend Is Building Next (Person A)

1. `GET /api/study-path/:studentId` — returns all subjects + roadmap nodes + XP + streak
2. `POST /api/tts` — voice responses

---

## Real Example — What the Tutor Returns

```json
{
  "reply": "Great question Marco! I checked your history — you've been struggling with Newton's laws so let me use a worked example...",
  "sessionId": "abc-123",
  "agentActivity": [
    { "agent": "orchestrator", "action": "Routing to Physics tutor...", "timestamp": "..." },
    { "agent": "memory", "action": "Reading Physics history for student...", "timestamp": "..." },
    { "agent": "tutor", "action": "Generating easy problem on Newton's Second Law...", "timestamp": "..." },
    { "agent": "assessment", "action": "Gap detected in F=ma — flagging...", "timestamp": "..." },
    { "agent": "memory", "action": "Saving session progress — XP +30...", "timestamp": "..." }
  ],
  "memoryUpdated": true,
  "xpGained": 30
}
```
