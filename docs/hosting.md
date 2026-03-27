# Hosting Guide

## Stack

| Service | Platform | Cost | Who sets it up |
|---|---|---|---|
| Backend API | Railway (Service 1) | free hobby tier | Person A |
| Postgres DB | Railway (addon) | free hobby tier | Person A |
| Frontend | Vercel | free | Person B |

---

## Step 1 — Backend on Railway (Person A)

1. Go to `railway.app` → open your project → **New Service → GitHub Repo**
2. Select `hackaton_hoiv` repo
3. Set **Root Directory** to `/backend`
4. Railway auto-detects Node.js → runs `npm install` + `npm start`
5. Add env vars in the service settings:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ELEVENLABS_API_KEY=...
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3001
   ```
6. Deploy → note your backend URL: `https://backend-xxx.up.railway.app`

---

## Step 2 — Postgres on Railway (Person A)

1. In same Railway project → **New Service → Database → PostgreSQL**
2. Railway automatically injects `DATABASE_URL` into your backend service
3. No extra config needed — the backend reads `process.env.DATABASE_URL` and creates tables on startup

---

## Step 3 — Frontend on Vercel (Person B)

1. Go to `vercel.com` → **Add Project** → Import GitHub repo
2. Set **Root Directory** to `/frontend`
3. Framework preset: **Vite**
4. Add env var:
   ```
   VITE_API_URL=https://backend-xxx.up.railway.app
   ```
5. Deploy → get frontend URL: `https://your-app.vercel.app`
6. Go back to Railway backend service → add:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```

---

## Auto-Deploy on Push to Main

Both Railway and Vercel watch the `main` branch by default.
- Push to `main` → Railway redeploys backend automatically
- Push to `main` → Vercel redeploys frontend automatically

**Workflow:** feature branch → PR → merge to main → auto-deploy

---

## Local Development

### Person A (backend)
```bash
# backend/.env  (copy from .env.example)
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
DATABASE_URL=postgresql://...   # use Railway Postgres URL even locally
PORT=3001

cd backend && npm install && npm run dev
```

### Person B (frontend)
```bash
# frontend/.env.local
VITE_API_URL=http://localhost:3001   # Person A running locally
# OR
VITE_API_URL=https://backend-xxx.up.railway.app   # use deployed backend

cd frontend && npm install && npm run dev
```

---

## Environment Variables Reference

### Backend (Railway)
```
ANTHROPIC_API_KEY       Anthropic API key
ELEVENLABS_API_KEY      ElevenLabs API key
DATABASE_URL            Auto-injected by Railway Postgres addon
FRONTEND_URL            Vercel frontend URL (for CORS)
PORT                    3001
```

### Frontend (Vercel)
```
VITE_API_URL            https://your-backend.up.railway.app
```
