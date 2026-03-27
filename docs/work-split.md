# Work Split

---

## Current Status (as of 2026-03-27)

### Person A (Backend) — DONE ✅
- Express + TypeScript + Postgres deployed on Railway
- Conversational onboarding (`/api/onboard/chat` + `/api/onboard/complete`)
- Agentic tutor with full Claude tool use loop (`/api/tutor/message`)
- Add subject for existing student (`/api/tutor/add`)
- Student memory read/write in Postgres JSONB
- XP + streak tracking

### Person A (Backend) — TODO
- [ ] `GET /api/study-path/:studentId` ← **build this next**
- [ ] `POST /api/tts` (ElevenLabs voice responses)

### Person B (Frontend) — TODO (everything)
- [ ] Project setup (Vite + React + TypeScript + Tailwind)
- [ ] Landing page
- [ ] Onboarding chat UI
- [ ] Dashboard (subject cards)
- [ ] Tutor chat page + agent sidebar

---

## Person A — Backend / AI (you are here)

**Owns:** `backend/` entirely

### Next: GET /api/study-path/:studentId

Returns all subjects + roadmap nodes + XP + streak for the dashboard.

Until this is live, Person B reads from `localStorage('studyPath')` as fallback.

**What to return:**
```typescript
{
  studentId: string
  studyPath: RoadmapNode[]
  xp: number
  level: number       // xp / 100, floored
  streak: number
  nextExam: { subject: string, date: string, daysLeft: number } | null
  todaysFocus: { subject: string, topic: string, reason: string }
}
```

Read from Postgres `students` table. Calculate `daysLeft` from `memory.examDates`.
Pick `todaysFocus` = subject with soonest exam, first available roadmap node.

### After that: POST /api/tts

ElevenLabs text-to-speech. Returns `audio/mpeg`.

```typescript
// Request: { text: string, voice?: string }
// Response: audio/mpeg binary
```

---

## Person B — Frontend / UI

**Owns:** `frontend/` entirely

### Setup
- [ ] Init Vite + React + TypeScript
- [ ] Install: `tailwindcss`, `shadcn/ui`, `framer-motion`, `react-router-dom`, `axios`
- [ ] Configure Tailwind dark mode (`class` strategy)
- [ ] Design tokens from `docs/design-system.md` as CSS vars
- [ ] React Router: `/`, `/onboarding`, `/dashboard`, `/tutor/:subject`
- [ ] `frontend/src/lib/api.ts` — all API calls here, uses `VITE_API_URL`

### Onboarding (`/onboarding`)
- [ ] Check `localStorage('studentId')`:
  - No studentId → new student flow (ask name first, then chat)
  - Has studentId → add subject flow (skip name, same chat, call `/api/tutor/add`)
- [ ] Chat loop: call `POST /api/onboard/chat` on each message, grow `messages[]`
- [ ] When `done: true`: show optional syllabus textarea → call `/api/onboard/complete`
- [ ] Save `studentId` + `studentName` + `studyPath` to localStorage → redirect `/dashboard`

### Dashboard (`/dashboard`)
- [ ] Read `studyPath` from localStorage (until `GET /api/study-path` is live)
- [ ] Group nodes by subject → one card per subject
- [ ] Each card: subject name, exam date, progress (X/Y nodes), `[Open tutor →]` button
- [ ] `+ Add new subject` card → navigates to `/onboarding`
- [ ] Show XP total (read from localStorage or response)

### Tutor (`/tutor/:subject`)
- [ ] Two-column layout: chat left, agent activity sidebar right
- [ ] Send message → `POST /api/tutor/message` with full `sessionHistory`
- [ ] Render `agentActivity[]` in sidebar as `[agent] action` lines
- [ ] Add `xpGained` to running XP display
- [ ] Mic button: Web Speech API → transcript → send as message (browser native, no backend)

### Design tokens (from `docs/design-system.md`):
```
primary:  #F59E0B  (gold — CTAs, highlights)
bgDark:   #0F172A  (charcoal — dark mode bg)
bgLight:  #F8FAFC  (soft white — light mode bg)
green:    #22C55E  (progress, completed nodes)
purple:   #8B5CF6  (AI features, agent sidebar)
blue:     #3B82F6  (info, links)
```

---

## Shared Touchpoints (sync here)

| When | What |
|---|---|
| Now | Person A: confirm `/api/onboard/chat`, `/api/tutor/message` work via curl |
| Next | Person A ships `GET /api/study-path` → Person B connects dashboard |
| After | Person A ships `POST /api/tts` → Person B connects voice playback |
| End | Full demo run-through, fix integration bugs |

**If shapes don't match → update `shared/types.ts` + `docs/api-contract.md` together.**

Reference doc for Person B: `docs/current-state.md` — full API shapes with TypeScript examples.
