# Hosting Guide

## Stack

| Service | Platform | Cost | Who sets it up |
|---|---|---|---|
| OpenClaw agent | Railway (Service 1) | ~$5/mo or free hobby | Person A |
| Backend API | Railway (Service 2) | free hobby tier | Person A |
| Frontend | Vercel | free | Person B |

---

## Step 1 — OpenClaw on Railway (Person A)

1. Go to: `https://railway.com/deploy/openclaw-complete-setup`
2. Click **Deploy** → connects to your Railway account
3. In the service settings, add env vars:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENCLAW_GATEWAY_TOKEN=make-up-any-secret-string
   ```
4. Add a **Persistent Volume** → mount path: `/data`
   (this is where OpenClaw stores all student memory)
5. Deploy → wait ~2 min → get your URL:
   `https://openclaw-[random].up.railway.app`
6. Open that URL → runs the OpenClaw setup wizard → complete it
7. Save the URL and token — backend needs both

---

## Step 2 — Backend on Railway (Person A)

1. In the same Railway project → **Add Service** → **GitHub Repo**
2. Select your repo, set **Root Directory** to `/backend`
3. Railway auto-detects Node.js, runs `npm run build && npm start`
4. Add env vars:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ELEVENLABS_API_KEY=...
   OPENCLAW_URL=https://openclaw-[random].up.railway.app
   OPENCLAW_TOKEN=your-secret-token-from-step-1
   PORT=3001
   ```
5. Deploy → get your backend URL:
   `https://backend-[random].up.railway.app`
6. Share this URL with Person B

---

## Step 3 — Frontend on Vercel (Person B)

1. Go to `vercel.com` → **Add Project** → Import GitHub repo
2. Set **Root Directory** to `/frontend`
3. Framework preset: **Vite**
4. Add env var:
   ```
   VITE_API_URL=https://backend-[random].up.railway.app
   ```
5. Deploy → get frontend URL:
   `https://your-app.vercel.app`

---

## Local Development

Each person runs their part locally, calls the other's Railway service.

### Person B (frontend dev)
```bash
# frontend/.env.local
VITE_API_URL=http://localhost:3001   # if Person A is also running locally
# OR
VITE_API_URL=https://backend-xxx.up.railway.app  # use Railway backend
```

### Person A (backend dev)
```bash
# backend/.env
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
OPENCLAW_URL=https://openclaw-xxx.up.railway.app  # always use Railway OpenClaw
OPENCLAW_TOKEN=...
PORT=3001
```

```bash
cd backend && npm run dev
# runs on localhost:3001
```

---

## Auto-Deploy Setup

Once Railway and Vercel are connected to GitHub:
- Push to `main` → Railway redeploys backend automatically
- Push to `main` → Vercel redeploys frontend automatically
- OpenClaw never needs redeployment (it's stateful, memory persists in /data)

---

## Environment Variables Reference

### OpenClaw (Railway Service 1)
```
ANTHROPIC_API_KEY       your Anthropic key
OPENCLAW_GATEWAY_TOKEN  random secret for auth
```

### Backend (Railway Service 2)
```
ANTHROPIC_API_KEY       your Anthropic key
ELEVENLABS_API_KEY      your ElevenLabs key
OPENCLAW_URL            https://openclaw-xxx.up.railway.app
OPENCLAW_TOKEN          same secret as above
PORT                    3001
```

### Frontend (Vercel)
```
VITE_API_URL            https://backend-xxx.up.railway.app
```

---

## .env.example files (commit these, not the real .env)

`backend/.env.example`:
```
ANTHROPIC_API_KEY=your-key-here
ELEVENLABS_API_KEY=your-key-here
OPENCLAW_URL=https://your-openclaw.up.railway.app
OPENCLAW_TOKEN=your-token-here
PORT=3001
```

`frontend/.env.example`:
```
VITE_API_URL=http://localhost:3001
```
