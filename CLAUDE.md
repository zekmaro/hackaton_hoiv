# CLAUDE.md — AI Study Platform (Hackathon MVP)

This file is read by Claude Code automatically. Follow every rule here without exception.
When in doubt, read this file before taking any action.

---

## What We Are Building

An AI-powered personalized study platform where students get a dynamic study roadmap,
talk to a voice AI tutor per subject, and receive proactive reminders.

**Core loop:**
Onboarding → AI Study Roadmap → Voice Tutor Sessions → Memory Updates → Next Session

**Key differentiator:** The AI tutor remembers everything across sessions via Postgres.
Multiple specialized Claude agents collaborate: orchestrator, subject tutors, assessment agent.

---

## Repository Structure

```
/
├── CLAUDE.md                  ← you are here
├── frontend/                  ← PERSON B owns this entirely
│   ├── src/
│   │   ├── components/        ← UI components
│   │   ├── pages/             ← route pages
│   │   ├── hooks/             ← custom React hooks
│   │   ├── lib/               ← frontend utilities, API client
│   │   └── types/             ← frontend-only types (import from shared/ when possible)
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── backend/                   ← PERSON A owns this entirely
│   ├── agents/                ← orchestrator + subject tutor agents
│   ├── skills/                ← background job definitions (Telegram reminders etc)
│   ├── memory/                ← Postgres read/write helpers
│   ├── api/                   ← Express route handlers
│   └── prompts/               ← all Claude system prompts as .ts files
│
├── shared/                    ← BOTH people read, NEITHER modifies alone
│   └── types.ts               ← single source of truth for all shared types
│
└── docs/                      ← reference documentation
    ├── architecture.md
    ├── api-contract.md
    ├── design-system.md
    ├── work-split.md
    └── hosting.md
```

---

## Ownership Rules (CRITICAL)

| Directory | Owner | Rule |
|---|---|---|
| `frontend/` | Person B | Person A never touches this |
| `backend/` | Person A | Person B never touches this |
| `shared/types.ts` | Both | Only modify via agreement + PR review |
| `docs/` | Both | Document changes when API or types change |
| `CLAUDE.md` | Both | Discuss before modifying |

**If you are Claude working in `frontend/`, never create or modify files in `backend/` and vice versa.**

---

## Absolute Rules

1. **Never hardcode API URLs** — always use `VITE_API_URL` env var in frontend, `PORT` in backend
2. **Never commit `.env` files** — use `.env.example` with placeholder values
3. **All shared data shapes live in `shared/types.ts`** — never duplicate type definitions
4. **API responses always match the contract in `docs/api-contract.md`** — check before implementing
5. **No `any` types in TypeScript** — use `unknown` and narrow, or define proper types in shared/
6. **All agent system prompts live in `backend/prompts/`** — never inline long prompts
7. **Frontend never calls Claude API directly** — always goes through backend
8. **Git: never commit directly to `main`** — always use feature branches (see `docs/git-workflow.md`)

---

## Tech Stack

### Frontend (Person B)
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)
- Web Speech API (speech-to-text, built into browser)
- `axios` for API calls
- React Router v6

### Backend (Person A)
- Node.js + Express + TypeScript
- Anthropic SDK (`@anthropic-ai/sdk`) — `claude-sonnet-4-6`
- Postgres (`pg`) — student memory, session history
- ElevenLabs SDK (text-to-speech)
- `zod` for request validation

### Memory Architecture
Student state lives in Postgres. Before every Claude call, we read the student's memory
from DB and inject it into the system prompt. After every session, we write updates back.
This gives the tutor full cross-session memory with zero external dependencies.

---

## Design Tokens (use these everywhere)

```typescript
colors: {
  primary:    '#F59E0B',   // gold orange — main CTA, highlights
  bgLight:    '#F8FAFC',   // soft white — light mode background
  bgDark:     '#0F172A',   // charcoal blue — dark mode background
  blue:       '#3B82F6',   // info, links
  green:      '#22C55E',   // progress, success, completed
  purple:     '#8B5CF6',   // AI features, advanced tools
}
```

---

## Hosting

- Frontend: Vercel (auto-deploys from `frontend/` on push to `main`)
- Backend: Railway Service (root dir: `backend/`, auto-deploys on push to `main`)
- Database: Railway Postgres addon (DATABASE_URL auto-injected into backend)

## API Base

- Frontend dev: `VITE_API_URL=http://localhost:3001`
- Frontend prod: `VITE_API_URL` = Railway backend URL (set in Vercel env vars)
- All endpoints: `docs/api-contract.md`
- All types: `shared/types.ts`

---

## mandatory: Read These Files at the Start of Every Session

**Do this before writing a single line of code:**

```
1. Read docs/current-state.md   ← what is live, what is not built, full API shapes
2. Read docs/api-contract.md    ← all endpoint contracts, request/response shapes
3. Read shared/types.ts         ← all shared TypeScript types
```

These three files are the source of truth. If something is not in them, it does not exist yet.

---

## API Contract Rules (CRITICAL)

### If you are Person B (frontend) and need a new endpoint:
1. Write the endpoint contract to `docs/api-contract.md` first (request + response shape)
2. Add the types to `shared/types.ts`
3. Commit and push
4. Tell Person A — they will build the backend
5. Only then implement the frontend call
6. **NEVER invent an endpoint and call it hoping the backend exists**

### If you are Person A (backend) and build a new endpoint:
1. Build the endpoint
2. Update `docs/api-contract.md` to mark it live
3. Update `docs/current-state.md`
4. Add types to `shared/types.ts` if needed
5. Commit everything together

### Currently live endpoints (check docs/current-state.md for full shapes):
- `POST /api/onboard/chat`
- `POST /api/onboard/complete`
- `POST /api/tutor/add`
- `POST /api/tutor/message`
- `GET  /api/study-path/:studentId`
- `GET  /api/study-path/:studentId/:subject`
- `POST /api/lesson/content`
- `POST /api/lesson/complete`

---

## Key Docs

- Current state + API shapes: `docs/current-state.md`
- API contract: `docs/api-contract.md`
- Architecture: `docs/architecture.md`
- Design system: `docs/design-system.md`
- Frontend issues: `docs/frontend-issues.md`
