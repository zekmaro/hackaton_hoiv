import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDB } from './memory/client'
import { onboardRouter } from './api/routes/onboard'
import { tutorRouter } from './api/routes/tutor'
import { addSubjectRouter } from './api/routes/addSubject'
import { studyPathRouter } from './api/routes/studyPath'
import { assessmentRouter } from './api/routes/assessment'
import { memoryRouter } from './api/routes/memory'
import { ttsRouter } from './api/routes/tts'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL ?? '',
  ],
  credentials: true,
}))

app.use(express.json())

// Health check — Person B uses this to confirm backend is running
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2',
    timestamp: new Date().toISOString(),
  })
})

// Routes
app.use('/api/onboard', onboardRouter)
app.use('/api/tutor', tutorRouter)
app.use('/api/tutor', addSubjectRouter)
app.use('/api/study-path', studyPathRouter)
app.use('/api/assessment', assessmentRouter)
app.use('/api/memory', memoryRouter)
app.use('/api/tts', ttsRouter)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message, code: 'AGENT_ERROR', status: 500 })
})

// Start server first, then init DB (so Railway health check passes regardless)
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

initDB()
  .then(() => console.log('DB ready'))
  .catch(err => console.error('DB init failed (non-fatal):', err))
