# CLAUDE.md — AI Study Platform (Hackathon MVP)

This file is read by Claude Code automatically. Follow every rule here without exception.
When in doubt, read this file before taking any action.

---

## What We Are Building

An AI-powered personalized study platform where students get a dynamic study roadmap,
talk to a voice AI tutor per subject, and receive proactive reminders via Telegram.

**Core loop:**
Onboarding → AI Study Roadmap → Voice Tutor Sessions → Memory Updates → Proactive Reminders

**Key differentiator:** The AI tutor remembers everything across sessions (via OpenClaw memory)
and multiple specialized agents collaborate behind the scenes.

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
│   ├── skills/                ← OpenClaw skill definitions
│   ├── memory/                ← OpenClaw memory read/write helpers
│   ├── api/                   ← Express route handlers
│   ├── prompts/               ← all Claude system prompts as .ts files
│   └── package.json
│
├── shared/                    ← BOTH people read, NEITHER modifies alone
│   └── types.ts               ← single source of truth for all shared types
│
└── docs/                      ← reference documentation
    ├── architecture.md
    ├── api-contract.md
    ├── design-system.md
    ├── work-split.md
    └── git-workflow.md
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
- `fetch` / `axios` for API calls
- React Router v6

### Backend (Person A)
- Node.js + Express + TypeScript
- Anthropic SDK (`@anthropic-ai/sdk`) — `claude-sonnet-4-6`
- OpenClaw (local agent, memory, cron, Telegram)
- ElevenLabs SDK (text-to-speech)
- `zod` for request validation

---

## Design Tokens (use these everywhere)

```typescript
// Always use these exact values
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
- Backend: Railway Service (auto-deploys from `backend/` on push to `main`)
- OpenClaw: Railway Service (official template, one-click at railway.com/deploy/openclaw-complete-setup)

## API Base

- Frontend dev: `http://localhost:3001` via `VITE_API_URL=http://localhost:3001`
- Frontend prod: `VITE_API_URL` set to Railway backend URL in Vercel env vars
- Backend talks to OpenClaw via `OPENCLAW_URL` env var (Railway internal URL)
- All endpoints documented in `docs/api-contract.md`
- All request/response types defined in `shared/types.ts`

---

## Key Docs to Read

- Architecture overview: `docs/architecture.md`
- Full API contract: `docs/api-contract.md`
- Design system: `docs/design-system.md`
- Who does what: `docs/work-split.md`
- Git workflow: `docs/git-workflow.md`
