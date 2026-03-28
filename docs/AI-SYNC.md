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
- POST /api/tutor/message  ← now supports mode=lesson|chat + topic
- GET  /api/study-path/:studentId
- GET  /api/study-path/:studentId/:subject
- POST /api/lesson/content  (static, legacy)
- POST /api/lesson/complete

## Frontend pages
- / Landing ✅
- /onboarding ✅
- /dashboard ✅
- /dashboard/:subject ✅
- /lesson/:nodeId ✅ (static version, being replaced)
- /tutor/:subject ✅

---

## Lesson flow — how it works now (IMPORTANT FOR PERSON B)

Lessons are now driven by the tutor agent in lesson mode. The `/lesson` page
should be replaced or rewired to use `/tutor/:subject` with mode=lesson.

### URL when clicking a roadmap node:
```
/tutor/{subjectName}?mode=lesson&topic={nodeTopic}&nodeId={nodeId}
```

### Tutor page in lesson mode:
1. On mount: auto-send `"Start lesson on: {topic}"` with `mode: "lesson"` and `topic`
2. Backend runs structured lesson: worked example → practice → harder challenge → mastery
3. Claude embeds phase markers in responses:
   - `[PHASE:example_done]` — show "Now let's practice" UI prompt
   - `[PHASE:practice]` — show practice problem UI state
   - `[PHASE:practice_passed]` — show success, move to challenge
   - `[PHASE:challenge_passed]` — show challenge complete
   - `[PHASE:complete]` — lesson done, show XP earned, back to roadmap button
4. Strip `[PHASE:xxx]` markers before rendering message text to student

### POST /api/tutor/message in lesson mode:
```typescript
{
  studentId: string,
  subject: string,          // exact subject name e.g. "Analysis 1"
  message: string,          // "Start lesson on: Limits" on first message
  voiceMode: false,
  mode: "lesson",           // NEW FIELD
  topic: string,            // e.g. "Limits and Epsilon-Delta Proofs"
  nodeId: string,           // e.g. "analysis1-series-intro"
  sessionHistory: []        // empty on first message
}
```

### Phase indicator UI (top of tutor page in lesson mode):
```
[ Worked Example ] → [ Practice ] → [ Challenge ] → [ Complete ]
```
Update active phase based on [PHASE:xxx] markers received.

### When [PHASE:complete] received:
- Show XP earned banner
- Show "Back to roadmap →" button → navigate(`/dashboard/${subject}`)
- Node will already be unlocked in DB (Claude called unlock_next_node)

---

## Rules
- Person B: before calling a new endpoint → write it to api-contract.md first
- Person A: after building an endpoint → update current-state.md + api-contract.md
- Never duplicate types — use shared/types.ts
