import { Router } from 'express'
// TODO: import ElevenLabs
// import { ElevenLabsClient } from 'elevenlabs'

export const ttsRouter = Router()

// POST /api/tts
// Converts tutor response text to audio via ElevenLabs
// Returns audio/mpeg binary
// Request shape: see shared/types.ts TTSRequest
ttsRouter.post('/', async (req, res, next) => {
  try {
    // TODO: implement
    // 1. Validate request (text, voice?)
    // 2. Call ElevenLabs API
    // 3. Stream audio/mpeg back
    // Frontend usage: const blob = await res.blob(); new Audio(URL.createObjectURL(blob)).play()
    res.json({ message: 'tts endpoint — TODO' })
  } catch (err) {
    next(err)
  }
})
