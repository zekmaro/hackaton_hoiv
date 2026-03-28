# Current State

Last updated: 2026-03-28

---

## Backend — What Is Live

**Deployed at:** https://hackatonhoiv-production.up.railway.app

| Endpoint | Status | Notes |
|---|---|---|
| `GET /health` | ✅ live | `{ status: ok, version: 2 }` |
| `POST /api/onboard/chat` | ✅ live | conversational interview, Haiku |
| `POST /api/onboard/complete` | ✅ live | creates student + study path in Postgres |
| `POST /api/tutor/add` | ✅ live | adds new subject to existing student |
| `POST /api/tutor/message` | ✅ live | agentic tutor — Claude tool use loop |
| `GET /api/study-path/:studentId` | ✅ live | returns roadmap + XP + streak from Postgres |
| `POST /api/tts` | ❌ not built | voice feature |
| `POST /api/assessment/start` | ❌ not built | skip for MVP |

---

## Frontend — What Needs Building

| Page | Status | Notes |
|---|---|---|
| `/` Landing | ✅ done | |
| `/onboarding` | ✅ done | calls backend, saves studentId to localStorage |
| `/dashboard` | ✅ done | fetches `GET /api/study-path/:studentId` |
| `/dashboard/:subject` SubjectDetail | ⚠️ hardcoded | needs real data wired up |
| `/tutor/:subject` Tutor | ❌ placeholder | most important — needs full build |

---

## localStorage Keys

```typescript
'studentId'    → string UUID (set after onboarding)
'studentName'  → string (set after onboarding)
'studyPath'    → JSON string of RoadmapNode[] (set after onboarding, fallback cache)
'theme'        → 'light' | 'dark'
```

---

## API Reference

### GET /api/study-path/:studentId

```typescript
// Response
{
  studentId: string
  studyPath: RoadmapNode[]   // all nodes across all subjects
  xp: number
  level: number              // Math.floor(xp / 100)
  streak: number
  nextExam: {
    subject: string
    date: string             // ISO
    daysLeft: number
  } | null
  todaysFocus: {
    subject: string
    topic: string
    reason: string
  }
  badges: []                 // empty for now
}
```

### POST /api/onboard/chat

```typescript
// Request
{ name: string, messages: { role: 'user' | 'assistant', content: string }[] }

// Response
{
  reply: string
  done: boolean
  extracted?: ExtractedOnboardData  // only when done: true
}
```

### POST /api/onboard/complete

```typescript
// Request
{
  name: string
  extracted: ExtractedOnboardData
  syllabus?: string
}

// Response
{
  studentId: string   // save to localStorage('studentId')
  studyPath: RoadmapNode[]
  xp: 0
  streak: 0
  nextFocus: string
}
```

### POST /api/tutor/add

```typescript
// Request — existing student adding a new subject
{
  studentId: string
  extracted: ExtractedOnboardData
  syllabus?: string
}

// Response
{
  studyPath: RoadmapNode[]   // new subject nodes only
  nextFocus: string
}
```

### POST /api/tutor/message

```typescript
// Request
{
  studentId: string
  subject: string         // must match subject name from onboarding exactly
  message: string
  voiceMode: boolean      // false for now
  sessionHistory: { role: 'user' | 'assistant', content: string }[]  // [] on first message
}

// Response
{
  reply: string
  sessionId: string
  agentActivity: {
    agent: 'orchestrator' | 'tutor' | 'assessment' | 'memory'
    action: string
    timestamp: string
  }[]
  memoryUpdated: boolean
  xpGained: number        // add to displayed XP
}
```

---

## SubjectDetail Page — How to Wire Up

The page is at `/dashboard/:subject`. The `:subject` param is the subject name lowercased.

```typescript
// 1. Get studentId from localStorage
const studentId = localStorage.getItem('studentId')

// 2. Fetch study path
GET /api/study-path/:studentId

// 3. Filter nodes for this subject
const subjectNodes = studyPath.filter(n =>
  n.subject.toLowerCase().replace(/\s+/g, '-') === subject  // match URL param
)

// 4. Display nodes with status colours:
// 'available'   → "Up next" / blue
// 'in_progress' → "In progress" / orange
// 'completed'   → "Completed" / green
// 'locked'      → "Locked" / grey, not clickable

// 5. Clicking an available/in_progress node → navigate to /tutor/[subject-name]
// 6. "Start now" button → navigate to /tutor/[subject-name]

// 7. "Week X of Y" calculation (frontend only, no backend needed):
const totalWeeks = Math.ceil(subjectNodes.length / 2)
const completedCount = subjectNodes.filter(n => n.status === 'completed').length
const currentWeek = Math.ceil((completedCount + 1) / 2)
```

**Subject name in URL vs API:** the URL uses lowercased-hyphenated form (`calculus-1`),
but the API needs the exact subject name from onboarding (`Calculus 1`).
Store the original name in localStorage or derive it from `studyPath[].subject`.

---

## Tutor Page — How to Build

This is the most important page for the demo. Route: `/tutor/:subject`

### Layout
```
┌──────────────────────────────┬─────────────────────┐
│  Chat area                   │  Agent Activity      │
│                              │                      │
│  [AI]: Hey! I read your      │  [orchestrator]      │
│  history...                  │  Routing to tutor... │
│                              │                      │
│  [You]: explain limits       │  [memory]            │
│                              │  Reading history...  │
│  [AI]: Great question...     │                      │
│                              │  [tutor]             │
│                              │  Generating problem  │
├──────────────────────────────┴─────────────────────┤
│  [🎤]  Type your message...              [Send →]  │
└────────────────────────────────────────────────────┘
```

### State needed
```typescript
const studentId = localStorage.getItem('studentId')
const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([])
const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
const [xp, setXp] = useState(0)
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
```

### Send message
```typescript
const sendMessage = async (text: string) => {
  const userMsg = { role: 'user' as const, content: text }
  const updatedHistory = [...messages, userMsg]
  setMessages(updatedHistory)
  setLoading(true)

  const res = await fetch(`${VITE_API_URL}/api/tutor/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId,
      subject,        // from useParams — must match exact name from onboarding
      message: text,
      voiceMode: false,
      sessionHistory: messages,  // history BEFORE this message
    })
  })

  const data = await res.json()
  setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
  setAgentActivity(prev => [...prev, ...data.agentActivity])
  setXp(prev => prev + data.xpGained)
  setLoading(false)
}
```

### Subject name matching
The URL param is lowercased (e.g. `calculus-1` or `calculus 1`).
The backend needs the exact subject name as stored during onboarding (e.g. `Calculus 1`).

Get the real name from `studyPath` in localStorage:
```typescript
const studyPath = JSON.parse(localStorage.getItem('studyPath') ?? '[]')
const subjectName = studyPath.find((n: RoadmapNode) =>
  n.subject.toLowerCase() === subject?.replace(/-/g, ' ')
)?.subject ?? subject
```

### Mic button (Web Speech API — no backend needed)
```typescript
const startListening = () => {
  const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()
  recognition.lang = 'en-US'
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    sendMessage(transcript)
  }
  recognition.start()
}
```

### Agent Activity sidebar
Each item from `agentActivity[]`:
```typescript
// Render as: [agent] action — timestamp
{ agent: 'memory', action: 'Reading Calculus 1 history...', timestamp: '...' }
```
Colour by agent: `orchestrator` = purple, `tutor` = orange, `memory` = blue, `assessment` = green.

---

## Real Example — Tutor Response

```json
{
  "reply": "Great question! Let me check your history first...",
  "sessionId": "abc-123",
  "agentActivity": [
    { "agent": "orchestrator", "action": "Routing message to Calculus 1 tutor agent...", "timestamp": "..." },
    { "agent": "memory", "action": "Reading Calculus 1 history for student...", "timestamp": "..." },
    { "agent": "tutor", "action": "Generating medium problem on limits...", "timestamp": "..." },
    { "agent": "memory", "action": "Saving session progress — XP +20...", "timestamp": "..." },
    { "agent": "tutor", "action": "Response ready.", "timestamp": "..." }
  ],
  "memoryUpdated": true,
  "xpGained": 20
}
```

---

## What Backend Is Building Next

- `POST /api/tts` — ElevenLabs text-to-speech (low priority, skip if no time)
