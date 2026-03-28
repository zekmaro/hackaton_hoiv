import { Router } from 'express'
import axios from 'axios'
import { z } from 'zod'

export const ttsRouter = Router()

const VOICE_IDS: Record<string, string> = {
  tutor: 'pNInz6obpgDQGcFmaJgB',      // Adam — clear, authoritative
  assessment: '21m00Tcm4TlvDq8ikWAM',  // Rachel — calm
  default: 'pNInz6obpgDQGcFmaJgB',
}

const schema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.enum(['tutor', 'assessment', 'default']).optional().default('tutor'),
})

ttsRouter.post('/', async (req, res, next) => {
  try {
    const { text, voice } = schema.parse(req.body)
    const voiceId = VOICE_IDS[voice ?? 'tutor']
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      res.status(500).json({ error: 'ElevenLabs API key not configured' })
      return
    }

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.0,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout: 15000,
      }
    )

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(response.data)
  } catch (err) {
    next(err)
  }
})
