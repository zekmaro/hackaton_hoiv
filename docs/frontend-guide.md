# Frontend Implementation Guide
## Everything the frontend AI needs to know and do

**Last updated: 2026-03-27**

Read this file fully before touching any page. It describes the current state, what is broken, and exactly how to fix it.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [LocalStorage schema](#2-localstorage-schema)
3. [Design tokens](#3-design-tokens)
4. [Page inventory and current state](#4-page-inventory-and-current-state)
5. [THE LESSON FLOW — read this carefully](#5-the-lesson-flow)
6. [API reference — exact shapes](#6-api-reference)
7. [What needs changing — prioritized](#7-what-needs-changing)
8. [Code snippets for every fix](#8-code-snippets-for-every-fix)

---

## 1. Architecture Overview

- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion
- Router: React Router v6
- API calls: `fetch` using `VITE_API_URL` env var (never hardcode URLs)
- All shared types: `shared/types.ts` — import from `@shared/types`
- Student state is in localStorage + Postgres (backend). On every page load, trust the API over localStorage.
- All AI responses come from the backend — frontend NEVER calls Claude directly.

---

## 2. LocalStorage Schema

```typescript
localStorage.getItem("studentId")   // UUID string — set after onboarding complete
localStorage.getItem("studyPath")   // JSON string of RoadmapNode[] — full path for all subjects
```

Always JSON.parse with a fallback:
```typescript
const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
```

---

## 3. Design Tokens

Use these exact values everywhere. Never invent new colors.

```
primary (gold orange): #F59E0B  — main CTA bg
primary dark (hover):  #e07b00
bgLight:               #F8FAFC  — page background
bgDark:                #0F172A  — dark mode
blue:                  #3B82F6  — info, links
green:                 #22C55E  — progress, success, completed
purple:                #8B5CF6  — AI features

border/card:           #E6D7C5
card bg:               #FFF4CC  with 70% opacity
card bg white:         #FFFFFF  with 80% opacity

user message bg:       #FF8C00  — warm orange
assistant message bg:  #FFF4CC
```

---

## 4. Page Inventory and Current State

### `/` — Landing
**Status: ✅ done, no changes needed**

---

### `/onboarding` — Onboarding
**Status: ✅ mostly done**

On complete: receives `{ studentId, studyPath, xp, streak, nextFocus }` from `POST /api/onboard/complete`.
Save to localStorage and navigate to `/dashboard`.

```typescript
localStorage.setItem("studentId", data.studentId)
localStorage.setItem("studyPath", JSON.stringify(data.studyPath))
navigate("/dashboard")
```

---

### `/dashboard` — Dashboard (subject list)
**Status: ✅ mostly done**

Fetches from `GET /api/study-path/:studentId`. Groups nodes by subject. Each subject card navigates to `/dashboard/:subject`.

**One known issue:** After adding a new subject via onboarding, the dashboard fetches from API and may get stale data if the API call was made too fast. This is now fixed on the backend — make sure to always fetch fresh from API, don't rely on localStorage here.

---

### `/dashboard/:subject` — Subject detail with roadmap
**Status: ⚠️ NEEDS CHANGES — node clicks go to wrong URL**

Currently when clicking a node:
```typescript
navigate(`/lesson/${encodeURIComponent(node.id)}`)  // ← WRONG
```

**Must change to:**
```typescript
navigate(
  `/tutor/${encodeURIComponent(node.subject)}?mode=lesson&topic=${encodeURIComponent(node.topic)}&nodeId=${encodeURIComponent(node.id)}`
)
```

This sends the user to the tutor page in **lesson mode** for that specific node.

---

### `/lesson/:nodeId` — Old static lesson page
**Status: 🔴 DEPRECATED — do not use, do not navigate to it**

This page used a static AI-generated lesson with a fixed quiz. It is being replaced by the agentic lesson flow in `/tutor/:subject`. Remove all navigation to `/lesson/:nodeId` and replace with the tutor URL above.

---

### `/tutor/:subject` — AI Tutor (chat + lesson)
**Status: ⚠️ NEEDS MAJOR CHANGES — lesson mode not implemented**

This is the most important page. See section 5 for the full lesson flow.

Current problems:
1. Reads `mode` from URL but sends it wrongly — URL has `mode=sprint` fallback, type system only allows `"lesson" | "chat"`
2. Does NOT send `mode`, `topic`, `nodeId` in the API payload
3. Auto-sends `"Help me understand: {topic}"` — should send `"Start lesson on: {topic}"` in lesson mode
4. Does NOT parse `[PHASE:xxx]` markers from Claude responses
5. Has no phase indicator UI (worked example → practice → challenge → complete)
6. Has no lesson complete state (XP banner + back to roadmap button)

---

## 5. The Lesson Flow

This is how lessons work now. Read this carefully — it drives how the Tutor page must behave.

### How it starts

User clicks a roadmap node in `/dashboard/:subject`. This navigates to:
```
/tutor/{subjectName}?mode=lesson&topic={nodeTopic}&nodeId={nodeId}
```

Example:
```
/tutor/Calculus%201?mode=lesson&topic=Limits%20and%20Epsilon-Delta%20Proofs&nodeId=calc1-limits-intro
```

### What the Tutor page must do on mount

Read these URL params:
```typescript
const { subject } = useParams<{ subject: string }>()
const searchParams = new URLSearchParams(location.search)
const mode = searchParams.get("mode") ?? "chat"      // "lesson" or "chat"
const topic = searchParams.get("topic") ?? ""
const nodeId = searchParams.get("nodeId") ?? ""
```

If `mode === "lesson"` and `topic` is present, auto-send this exact message on mount (once):
```typescript
sendMessage(`Start lesson on: ${topic}`)
```
This triggers the backend lesson flow.

### How the backend responds

The backend Claude agent runs a 4-phase structured lesson. It embeds **phase markers** in its text responses:

| Marker | When it appears | Meaning |
|---|---|---|
| `[PHASE:example_done]` | After worked example | Show: "Now let's practice" UI |
| `[PHASE:practice]` | After practice problem posted | Highlight Practice phase active |
| `[PHASE:practice_passed]` | Student answered correctly | Show success, move to challenge |
| `[PHASE:challenge_passed]` | Harder challenge passed | Show challenge complete |
| `[PHASE:complete]` | Lesson fully done | Show XP banner + back to roadmap |

**You must strip these markers before showing the message to the student.**

### API payload for lesson mode

```typescript
const payload: TutorMessageRequest = {
  studentId,
  subject: realSubjectName,    // exact case from DB, not URL lowercase
  message: trimmed,
  voiceMode: false,
  mode: mode as "lesson" | "chat",   // from URL param
  topic: topic || undefined,          // from URL param
  nodeId: nodeId || undefined,        // from URL param
  sessionHistory: messages.map(m => ({ role: m.role, content: m.content })),
}
```

**Important:** `subject` must be the original-cased name from the DB (e.g. `"Calculus 1"`, not `"calculus 1"`). Get it from localStorage studyPath:
```typescript
const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
const realSubjectName = studyPath.find(
  (n) => n.subject.toLowerCase() === decodedSubject.toLowerCase()
)?.subject ?? decodedSubject
```

### Parsing phase markers

```typescript
function parsePhase(text: string): { clean: string; phase: string | null } {
  const phaseMatch = text.match(/\[PHASE:([a-z_]+)\]/)
  const phase = phaseMatch ? phaseMatch[1] : null
  const clean = text.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
  return { clean, phase }
}
```

Call this on every assistant message before rendering:
```typescript
const { clean, phase } = parsePhase(data.reply)
setMessages(prev => [...prev, { role: "assistant", content: clean }])
if (phase) setCurrentPhase(phase)
```

### Phase indicator UI (lesson mode only)

Show this progress bar at the top when `mode === "lesson"`:

```
[ Worked Example ] → [ Practice ] → [ Challenge ] → [ Complete ]
```

State shape:
```typescript
type LessonPhase = "example" | "practice" | "challenge" | "complete"
const [currentPhase, setCurrentPhase] = useState<LessonPhase>("example")
```

Phase marker → UI state mapping:
```typescript
if (phase === "example_done") setCurrentPhase("practice")
if (phase === "practice")     setCurrentPhase("practice")
if (phase === "practice_passed") setCurrentPhase("challenge")
if (phase === "challenge_passed") setCurrentPhase("complete")
if (phase === "complete")     setCurrentPhase("complete")
```

### Lesson complete state

When `phase === "complete"`:
- Show XP earned banner: `+{xpGained} XP — Lesson complete!`
- Show "Back to roadmap →" button that navigates to `/dashboard/${encodeURIComponent(subject)}`
- The backend already marked the node as completed in the DB

---

## 6. API Reference

All endpoints: `${VITE_API_URL}/api/...`

Always resolve like this:
```typescript
const resolveApiUrl = (path: string) =>
  apiBase.endsWith("/api") ? `${apiBase}${path}` : `${apiBase}/api${path}`
```

---

### POST /api/tutor/message

**Request:**
```typescript
interface TutorMessageRequest {
  studentId: string           // UUID from localStorage
  subject: string             // EXACT original case e.g. "Calculus 1"
  message: string             // user's text
  voiceMode: boolean          // always false for now
  mode: "lesson" | "chat"     // lesson = structured, chat = free
  topic?: string              // required when mode=lesson — the roadmap node topic
  nodeId?: string             // required when mode=lesson — the roadmap node id
  sessionHistory: { role: "user" | "assistant"; content: string }[]
  sessionId?: string          // optional, ignored by backend currently
}
```

**Response:**
```typescript
interface TutorMessageResponse {
  reply: string               // Claude's response — may contain [PHASE:xxx] markers, strip before showing
  sessionId: string
  agentActivity: AgentActivity[]
  memoryUpdated: boolean
  xpGained: number            // 0 if none, otherwise 10/20/40
  newBadge?: Badge
}
```

---

### GET /api/study-path/:studentId

**Response:**
```typescript
interface StudyPathResponse {
  studentId: string
  studyPath: RoadmapNode[]    // ALL nodes across all subjects
  xp: number
  level: number
  streak: number
  nextExam: { subject: string; date: string; daysLeft: number } | null
  todaysFocus: { subject: string; topic: string; reason: string }
  badges: Badge[]
}
```

---

### GET /api/study-path/:studentId/:subject

Returns nodes for one subject only. `subject` in URL should be URL-encoded original case.

**Response:**
```typescript
{
  studentId: string
  subject: string             // exact name from DB
  nodes: RoadmapNode[]        // only for this subject
  xp: number
  level: number
  streak: number
  nextExam: { subject: string; date: string; daysLeft: number } | null
  badges: Badge[]
}
```

---

### POST /api/onboard/chat

**Request:**
```typescript
interface OnboardChatRequest {
  name: string
  messages: { role: "user" | "assistant"; content: string }[]
}
```

**Response:**
```typescript
interface OnboardChatResponse {
  reply: string
  done: boolean
  extracted?: ExtractedOnboardData   // only when done: true
}
```

---

### POST /api/onboard/complete

**Request:**
```typescript
interface OnboardCompleteRequest {
  name: string
  extracted: ExtractedOnboardData
  syllabus?: string
}
```

**Response:**
```typescript
interface OnboardResponse {
  studentId: string
  studyPath: RoadmapNode[]
  xp: number
  streak: number
  nextFocus: string
}
```

---

### POST /api/lesson/complete

Call this only if still on the old static lesson page (being deprecated). For lesson mode via tutor, the backend calls unlock automatically.

**Request:**
```typescript
interface LessonCompleteRequest {
  nodeId: string
  studentId: string
  score: number     // 0–100
}
```

---

## 7. What Needs Changing — Prioritized

### P0 — Breaks the lesson flow entirely

#### A. SubjectDetail: node click goes to `/lesson/:nodeId` — must go to tutor

File: `frontend/src/pages/SubjectDetail.tsx` line ~302

```typescript
// CURRENT (broken):
navigate(`/lesson/${encodeURIComponent(node.id)}`)

// CORRECT:
navigate(
  `/tutor/${encodeURIComponent(node.subject)}?mode=lesson&topic=${encodeURIComponent(node.topic)}&nodeId=${encodeURIComponent(node.id)}`
)
```

Do the same for the "Start now" button at the bottom (line ~357).

#### B. Tutor page: doesn't send mode/topic/nodeId to API

File: `frontend/src/pages/Tutor.tsx` lines ~89-95

The payload is missing `mode`, `topic`, `nodeId`. See section 8A for the full corrected payload.

#### C. Tutor page: auto-send uses wrong message text for lesson mode

File: `frontend/src/pages/Tutor.tsx` line ~127

```typescript
// CURRENT (wrong for lesson mode):
void sendMessage(`Help me understand: ${topic}`)

// CORRECT:
const isLesson = mode === "lesson"
void sendMessage(isLesson ? `Start lesson on: ${topic}` : `Help me understand: ${topic}`)
```

#### D. Tutor page: doesn't parse [PHASE:xxx] markers from responses

File: `frontend/src/pages/Tutor.tsx` — entire message receive section

Phase markers must be stripped before rendering. See section 8B.

---

### P1 — Broken UX

#### E. Tutor page: no phase indicator when in lesson mode

Add a progress bar at the top of the chat area when `mode === "lesson"`. See section 8C.

#### F. Tutor page: no lesson complete state

When `[PHASE:complete]` is received, show XP earned + "Back to roadmap" button. See section 8D.

#### G. Tutor page: `mode` parsed from URL but wrong fallback

```typescript
// CURRENT:
const mode = searchParams.get("mode") ?? "sprint"   // ← "sprint" is not a valid mode

// CORRECT:
const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"
```

---

### P2 — Polish

#### H. Render assistant messages as Markdown

Claude uses `**bold**`, `- bullet lists`, `code blocks`, and plain math notation. Render with `react-markdown`:

```tsx
import ReactMarkdown from "react-markdown"
// in message render:
<ReactMarkdown>{message.content}</ReactMarkdown>
```

Already installed. Already used in SubjectDetail.tsx.

#### I. Show XP earned toast per message

The response always includes `xpGained`. Show a brief `+{xp} XP` indicator after each assistant message. The current page shows it as a line below the input — fine for now.

---

## 8. Code Snippets for Every Fix

### 8A — Corrected API payload in Tutor.tsx sendMessage

```typescript
// At top of Tutor component, derive params:
const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
const topic = searchParams.get("topic") ?? ""
const nodeId = searchParams.get("nodeId") ?? ""
const mode = (searchParams.get("mode") ?? "chat") as "lesson" | "chat"

// Inside sendMessage, replace the payload with:
const studyPath = JSON.parse(localStorage.getItem("studyPath") ?? "[]") as RoadmapNode[]
const realSubjectName =
  studyPath.find((n) => n.subject.toLowerCase() === decodedSubject.toLowerCase())?.subject
  ?? decodedSubject

const payload: TutorMessageRequest = {
  studentId,
  subject: realSubjectName,
  message: trimmed,
  voiceMode: false,
  mode,
  topic: topic || undefined,
  nodeId: nodeId || undefined,
  sessionHistory: messages.map((m) => ({ role: m.role, content: m.content })),
}
```

### 8B — Parse phase markers in Tutor.tsx

Add this helper outside the component:
```typescript
function parsePhase(text: string): { clean: string; phase: string | null } {
  const match = text.match(/\[PHASE:([a-z_]+)\]/)
  const phase = match ? match[1] : null
  const clean = text.replace(/\[PHASE:[a-z_]+\]/g, "").trim()
  return { clean, phase }
}
```

Add state:
```typescript
type LessonPhase = "example" | "practice" | "challenge" | "complete"
const [currentPhase, setCurrentPhase] = useState<LessonPhase>("example")
const [lessonComplete, setLessonComplete] = useState(false)
```

In sendMessage, replace the message-setting with:
```typescript
const { clean, phase } = parsePhase(data.reply)
setMessages((prev) => [...prev, { role: "assistant", content: clean }])

if (phase === "example_done") setCurrentPhase("practice")
if (phase === "practice")     setCurrentPhase("practice")
if (phase === "practice_passed") setCurrentPhase("challenge")
if (phase === "challenge_passed") setCurrentPhase("complete")
if (phase === "complete") {
  setCurrentPhase("complete")
  setLessonComplete(true)
}
```

### 8C — Phase indicator UI

Add this above the message list, only when `mode === "lesson"`:

```tsx
{mode === "lesson" && (
  <div className="flex items-center gap-2 mb-4 text-sm flex-wrap">
    {(["example", "practice", "challenge", "complete"] as const).map((phase, i) => {
      const labels: Record<typeof phase, string> = {
        example: "Worked Example",
        practice: "Practice",
        challenge: "Challenge",
        complete: "Complete",
      }
      const phases: typeof phase[] = ["example", "practice", "challenge", "complete"]
      const currentIndex = phases.indexOf(currentPhase)
      const phaseIndex = phases.indexOf(phase)
      const isDone = phaseIndex < currentIndex
      const isActive = phase === currentPhase
      return (
        <span key={phase} className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
              isDone
                ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#15803D]"
                : isActive
                ? "bg-[#FF8C00] border-[#FF8C00] text-white"
                : "bg-white/60 border-[#E6D7C5] text-muted-foreground"
            }`}
          >
            {labels[phase]}
          </span>
          {i < 3 && <span className="text-muted-foreground">→</span>}
        </span>
      )
    })}
  </div>
)}
```

### 8D — Lesson complete banner

Add this after the message list, when `lessonComplete === true`:

```tsx
{lessonComplete && (
  <div className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-5 flex flex-col gap-3">
    <p className="text-[#15803D] font-bold text-lg">
      Lesson complete! +{totalXp} XP earned
    </p>
    <p className="text-sm text-muted-foreground">
      You have mastered: {topic}
    </p>
    <button
      type="button"
      onClick={() => navigate(`/dashboard/${encodeURIComponent(decodedSubject)}`)}
      className="self-start rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-bold text-white hover:bg-green-600 transition-colors"
    >
      Back to roadmap →
    </button>
  </div>
)}
```

### 8E — Auto-send on mount (corrected)

Replace the existing useEffect:
```typescript
useEffect(() => {
  if (topic && messages.length === 0 && !autoSentRef.current) {
    autoSentRef.current = true
    const firstMessage = mode === "lesson"
      ? `Start lesson on: ${topic}`
      : `Help me understand: ${topic}`
    void sendMessage(firstMessage)
  }
}, [topic, mode, messages.length, sendMessage])
```

### 8F — SubjectDetail node click fix

In `frontend/src/pages/SubjectDetail.tsx`, find the two places that call `navigate('/lesson/...')` and replace:

```typescript
// Node card onClick (around line 302):
const onClick = () => {
  if (locked) return
  navigate(
    `/tutor/${encodeURIComponent(node.subject)}?mode=lesson&topic=${encodeURIComponent(node.topic)}&nodeId=${encodeURIComponent(node.id)}`
  )
}

// "Start now" button onClick (around line 357):
onClick={() =>
  navigate(
    `/tutor/${encodeURIComponent(nextNode.subject)}?mode=lesson&topic=${encodeURIComponent(nextNode.topic)}&nodeId=${encodeURIComponent(nextNode.id)}`
  )
}
```

---

## Summary of files to change

| File | Changes |
|---|---|
| `frontend/src/pages/SubjectDetail.tsx` | Node click → tutor URL (8F) |
| `frontend/src/pages/Tutor.tsx` | Payload (8A), phase parsing (8B), phase UI (8C), complete banner (8D), auto-send (8E), mode fallback fix |

Do NOT touch any files in `backend/` or `shared/`.
