import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiClient } from '../lib/api'
import { useStudentId } from '../hooks/useStudentId'
import { useVoice } from '../hooks/useVoice'
import type { TutorMessageResponse, AgentActivity } from '@shared/types'

// Tutor page layout:
// Left: chat/voice transcript
// Right: AgentActivitySidebar
// Bottom: input bar with mic button

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Tutor() {
  const { subject } = useParams<{ subject: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const { getStudentId } = useStudentId()

  const handleSend = async (text: string) => {
    if (!text.trim() || !subject) return
    const studentId = getStudentId()
    if (!studentId) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res: TutorMessageResponse = await ApiClient.sendTutorMessage({
        studentId,
        subject,
        message: text,
        voiceMode: false,
        sessionId,
      })

      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
      setAgentActivity(prev => [...prev, ...res.agentActivity])
      setSessionId(res.sessionId)

      // TODO: if voiceMode, call ApiClient.tts(res.reply) and play audio
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const { listen, isListening } = useVoice(handleSend)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4">
        <h1 className="font-semibold text-slate-900 dark:text-white capitalize">
          {subject} Tutor
        </h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <p className="text-slate-400 text-center mt-16">
                Ask your {subject} tutor anything, or hold the mic to speak.
              </p>
            )}
            {/* TODO: ChatMessage component per message */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-amber-400 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm text-slate-400">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          {/* TODO: ChatInput component with mic button */}
          <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex gap-3">
            <input
              type="text"
              placeholder={`Ask about ${subject}...`}
              className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSend((e.target as HTMLInputElement).value)
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
            />
            {/* TODO: VoiceButton component — pulsing when isListening */}
            <button
              onClick={listen}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isListening ? 'bg-red-500' : 'bg-amber-400 hover:bg-amber-500'
              }`}
            >
              🎤
            </button>
          </div>
        </div>

        {/* Agent activity sidebar */}
        {/* TODO: AgentActivitySidebar component */}
        <aside className="w-72 border-l border-slate-100 dark:border-slate-700 p-4 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Agent Activity
          </h2>
          <div className="space-y-2">
            {agentActivity.map((a, i) => (
              <div key={i} className={`text-xs px-3 py-2 rounded-lg ${
                a.agent === 'orchestrator' ? 'bg-violet-100 text-violet-700' :
                a.agent === 'tutor'        ? 'bg-blue-100 text-blue-700' :
                a.agent === 'assessment'   ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
              }`}>
                <span className="font-medium capitalize">{a.agent}:</span> {a.action}
              </div>
            ))}
            {agentActivity.length === 0 && (
              <p className="text-slate-400 text-xs">Agent activity will appear here during sessions.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
