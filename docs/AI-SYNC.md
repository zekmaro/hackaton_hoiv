# AI Sync — Read This First

## What's built
See: `docs/current-state.md`

## API shapes + contracts
See: `docs/api-contract.md`

## All TypeScript types
See: `shared/types.ts`

## Frontend bugs + todo
See: `docs/frontend-issues.md`

---

## Live endpoints
- POST /api/onboard/chat
- POST /api/onboard/complete
- POST /api/tutor/add
- POST /api/tutor/message
- GET  /api/study-path/:studentId
- GET  /api/study-path/:studentId/:subject
- POST /api/lesson/content
- POST /api/lesson/complete

## Frontend pages
- / Landing ✅
- /onboarding ✅
- /dashboard ✅
- /dashboard/:subject ✅
- /lesson/:nodeId ✅
- /tutor/:subject ✅

---

## Rules
- Person B: before calling a new endpoint → write it to api-contract.md first
- Person A: after building an endpoint → update current-state.md + api-contract.md
- Never duplicate types — use shared/types.ts
