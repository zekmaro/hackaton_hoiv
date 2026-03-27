# Work Split

---

## Person A — Backend / AI / Agents

**Owns:** `backend/` entirely

### Priority Order (build in this order)

**Hour 0-1: Project setup + Railway deploy**
- [ ] Deploy OpenClaw to Railway via one-click: `railway.com/deploy/openclaw-complete-setup`
  - Set `ANTHROPIC_API_KEY` in OpenClaw Railway service env vars
  - Set `OPENCLAW_GATEWAY_TOKEN` (create a random secret, save it)
  - Enable persistent volume at `/data`
  - Note the Railway domain: `https://openclaw-xxx.up.railway.app`
- [ ] Init Node.js + Express + TypeScript in `backend/`
- [ ] Install: `@anthropic-ai/sdk`, `elevenlabs`, `zod`, `express`, `cors`, `dotenv`
- [ ] Create `.env.example` with: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `OPENCLAW_URL`, `OPENCLAW_TOKEN`, `PORT=3001`
- [ ] Set up `backend/api/index.ts` with Express app and CORS for `localhost:5173` and Vercel domain
- [ ] Connect backend repo to Railway as second service (root dir: `backend/`)
- [ ] Health check: `GET /health` returns `{ status: 'ok', openclaw: 'connected' }`

**Hour 1-3: Core agents**
- [ ] Write system prompts in `backend/prompts/orchestrator.ts`
- [ ] Write system prompts in `backend/prompts/tutors/math.ts` (template for all subjects)
- [ ] Write system prompt in `backend/prompts/assessment.ts`
- [ ] Build `POST /api/onboard` → calls Claude with structured output → returns `OnboardResponse`
- [ ] Build `POST /api/tutor/message` → Orchestrator routes to subject tutor → returns `TutorMessageResponse`

**Hour 3-5: Memory + OpenClaw**
- [ ] Set up OpenClaw locally, configure Claude API key in OpenClaw
- [ ] Build `backend/memory/client.ts` — read/write helpers for OpenClaw memory
- [ ] Build `backend/skills/exam-reminder.ts` — OpenClaw cron skill for Telegram
- [ ] Build `backend/skills/session-log.ts` — logs every session to OpenClaw memory
- [ ] Wire memory reads into agent prompts (inject student context)
- [ ] Build `GET /api/memory/:studentId`

**Hour 5-7: Study path + assessment**
- [ ] Build `GET /api/study-path/:studentId` — reads memory + recalculates roadmap
- [ ] Build `POST /api/assessment/start` — spawns assessment agent
- [ ] Build `POST /api/assessment/submit` — evaluates answers, updates memory

**Hour 7-8: Voice**
- [ ] Build `POST /api/tts` — calls ElevenLabs, returns audio/mpeg
- [ ] Test end-to-end voice pipeline with frontend

**Hour 8+: Polish**
- [ ] Add `agentActivity[]` events to all responses
- [ ] Add XP calculation logic (50 XP per session, 100 for assessment, bonus for streak)
- [ ] Test Telegram reminder fires correctly
- [ ] Error handling for all routes

---

## Person B — Frontend / UI

**Owns:** `frontend/` entirely

### Priority Order (build in this order)

**Hour 0-1: Project setup**
- [ ] Init Vite + React + TypeScript in `frontend/`
- [ ] Install: `tailwindcss`, `shadcn/ui`, `framer-motion`, `react-router-dom`, `axios`
- [ ] Configure Tailwind with dark mode (`class` strategy)
- [ ] Add CSS variables for design tokens from `docs/design-system.md`
- [ ] Set up React Router with routes: `/`, `/onboarding`, `/dashboard`, `/tutor/:subject`
- [ ] Create `frontend/src/lib/api.ts` — typed API client (all fetch calls live here, uses `VITE_API_URL`)

**Hour 1-3: Onboarding + Landing**
- [ ] Build multi-step onboarding form (`/onboarding`) — 4 steps as per design-system.md
- [ ] On submit: call `POST /api/onboard`, store `studentId` in localStorage, redirect to `/dashboard`
- [ ] Build landing page (`/`) — hero section + "how it works" + CTA button → `/onboarding`
- [ ] Dark mode toggle component (top right)

**Hour 3-5: Dashboard**
- [ ] Build dashboard layout (sidebar + main)
- [ ] Roadmap visualization component — nodes from `RoadmapNode[]`, status colors from design-system.md
- [ ] XP bar + level indicator
- [ ] Streak counter
- [ ] "Today's Focus" card
- [ ] Connect to `GET /api/study-path/:studentId`

**Hour 5-7: Tutor Page**
- [ ] Build tutor page layout (chat + agent activity sidebar)
- [ ] Chat message list component (user + AI messages)
- [ ] Text input + send button
- [ ] Connect to `POST /api/tutor/message`
- [ ] Agent Activity sidebar — renders `AgentActivity[]` from each response
- [ ] Voice: mic button using Web Speech API → sends transcript to tutor API
- [ ] Voice: auto-play audio from `POST /api/tts` after each tutor response

**Hour 7-8: Polish**
- [ ] Framer Motion animations (page transitions, node completion, badge earned)
- [ ] Badge notification popup when `newBadge` is in response
- [ ] Loading states for all API calls
- [ ] Error states (what to show when backend is down)
- [ ] Responsive layout check

---

## Shared Touchpoints (coordinate here)

These are the only moments you need to sync:

| When | What |
|---|---|
| Hour 1 | Agree that backend health check works on `localhost:3001/health` |
| Hour 2 | Person A shares exact `OnboardResponse` shape — Person B updates frontend form submit handler |
| Hour 4 | Person A deploys `/api/study-path` — Person B connects dashboard |
| Hour 5 | Person A deploys `/api/tutor/message` — Person B connects chat |
| Hour 7 | Person A deploys `/api/tts` — Person B connects voice playback |
| Hour 8 | Full demo run-through together, fix integration bugs |

---

## Before Each Sync

Person A: confirm the endpoint is running and returning the shape from `docs/api-contract.md`
Person B: confirm the frontend is sending the request shape from `docs/api-contract.md`

If shapes don't match → update `shared/types.ts` + `docs/api-contract.md` together.
