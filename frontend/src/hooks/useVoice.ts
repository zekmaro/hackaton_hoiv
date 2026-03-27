import { useState, useCallback } from 'react'

// Web Speech API hook — zero dependencies, works in Chrome/Edge/Safari
// Usage: const { listen, isListening, transcript } = useVoice()

export function useVoice(onResult: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const listen = useCallback(() => {
    // TODO: implement
    // 1. Check window.SpeechRecognition || window.webkitSpeechRecognition
    // 2. Start recognition, set isListening = true
    // 3. On result → set transcript, call onResult(transcript), setIsListening(false)
    // 4. On error → setIsListening(false)
    console.warn('useVoice: TODO implement Web Speech API')
  }, [onResult])

  const playAudio = useCallback(async (audioBlob: Blob) => {
    // TODO: implement
    // const url = URL.createObjectURL(audioBlob)
    // const audio = new Audio(url)
    // await audio.play()
    // audio.onended = () => URL.revokeObjectURL(url)
    console.warn('useVoice: TODO implement playAudio')
  }, [])

  return { listen, isListening, transcript, playAudio }
}
