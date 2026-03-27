# Git Workflow

Two people, zero merge conflicts. Follow this exactly.

---

## Branch Strategy

```
main              ← stable, demo-ready at all times
  └── personA/feature-name    ← Person A's branches
  └── personB/feature-name    ← Person B's branches
```

**Never commit directly to `main`.**

---

## Person A Branch Names
```
personA/setup-backend
personA/onboard-endpoint
personA/tutor-agents
personA/memory-openclaw
personA/assessment-agent
personA/tts-endpoint
personA/polish
```

## Person B Branch Names
```
personB/setup-frontend
personB/landing-onboarding
personB/dashboard
personB/tutor-page
personB/voice-ui
personB/animations-polish
```

---

## Daily Flow

```bash
# Start of work
git checkout main
git pull origin main
git checkout -b personA/your-feature   # or personB/

# Work on your feature
git add backend/   # or frontend/ — ONLY your directory
git commit -m "feat: add tutor message endpoint"

# Push
git push origin personA/your-feature

# Open PR on GitHub → other person does quick review → merge to main
```

---

## Merge Flow

1. Push your branch
2. Open PR on GitHub
3. Other person reviews (5 min check — does it conflict? does API contract match?)
4. Merge via **Squash and Merge**
5. Both: `git pull origin main` before starting next feature

---

## Conflict Prevention Rules

| Rule | Why |
|---|---|
| Person A only `git add backend/` | Never touches frontend files |
| Person B only `git add frontend/` | Never touches backend files |
| `shared/types.ts` changes → both review | This file affects both sides |
| `CLAUDE.md` or `docs/` changes → both review | Shared context must stay accurate |
| Never force push | Protect each other's work |

---

## Shared Files — Change Protocol

For `shared/types.ts` or `docs/api-contract.md`:

1. Talk to each other first (30 second discussion)
2. One person makes the change on their feature branch
3. Other person reviews in PR before merge
4. Both pull main before continuing

---

## .gitignore (add to root)

```
node_modules/
.env
.env.local
dist/
.DS_Store
*.log
frontend/.env
backend/.env
```

---

## Initial Repo Setup (do once together)

```bash
git init
git add CLAUDE.md docs/ shared/ .gitignore
git commit -m "chore: project structure, docs, shared types"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/REPO_NAME.git
git push -u origin main
```

Then each person:
```bash
git checkout -b personA/setup-backend
# or
git checkout -b personB/setup-frontend
```
