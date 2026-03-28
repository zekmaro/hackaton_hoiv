# Start Every Session With This

Copy and paste this as your FIRST message to Claude Code:

---

**Person A (backend):**
```
Read CLAUDE.md, docs/current-state.md, docs/api-contract.md, and shared/types.ts.
Summarise what is currently live on the backend, what is missing, and what frontend
is expecting that backend hasn't built yet. Then we'll decide what to work on.
```

**Person B (frontend):**
```
Read CLAUDE.md, docs/current-state.md, docs/api-contract.md, and shared/types.ts.
Summarise what frontend pages are built, what API endpoints are available to call,
and what is broken or missing. Then we'll decide what to work on.
```

---

## Why this matters

- Claude does not remember previous conversations
- Without reading these files it will invent endpoints that don't exist
- These files are the only shared memory between the two AIs
