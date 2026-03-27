import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

type Message = { role: "assistant" | "user"; content: string }

const assistantSteps = [
  "Hey! I'm your StudyUp tutor. What are you studying right now?",
  "Great. What goal are you aiming for? (exam date, score, or topic)",
  "How confident do you feel in those subjects today?",
  "How much time can you study per day on average?",
  "Do you prefer short sprints or longer sessions?",
  "Awesome. Want daily reminders at a specific time?",
  "You're all set. Building your study path now.",
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: assistantSteps[0] },
  ])
  const [input, setInput] = useState("")
  const [step, setStep] = useState(0)

  const progress = useMemo(() => {
    if (step === 0) return 0
    if (step >= assistantSteps.length - 1) return 100
    return Math.min(Math.round((step / 7) * 95), 95)
  }, [step])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const nextStep = Math.min(step + 1, assistantSteps.length - 1)
    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: assistantSteps[nextStep] },
    ]
    setMessages(updatedMessages)
    setInput("")
    setStep(nextStep)

    if (nextStep === assistantSteps.length - 1) {
      setTimeout(() => {
        navigate("/dashboard")
      }, 800)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#E6D7C5]">
        <div
          className="h-full bg-[#FF8C00] transition-[width] duration-700 ease-out shadow-[0_0_8px_rgba(255,140,0,0.45)]"
          style={{ width: `${progress}%` }}
        />
        {progress > 0 && (
          <span className="absolute right-4 top-2 text-[12px] font-medium text-[#FF8C00]">
            {progress}%
          </span>
        )}
      </div>

      {/* Top bar */}
      <div className="mt-[3px] px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-lg">
          <span className="text-[#FF8C00] font-semibold">StudyUp</span>
          <span className="text-foreground/80">study</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Setting up your tutor...
        </span>
      </div>

      {/* Chat area */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-8 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === "user"
                    ? "bg-[#FF8C00] text-white"
                    : "bg-[#FFF4CC] text-foreground"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="w-full border-t border-[#E6D7C5] bg-[#FFF4CC]/60 px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend()
            }}
            placeholder="Type your answer..."
            className="flex-1 rounded-xl border border-[#E6D7C5] bg-white/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
          />
          <button
            onClick={handleSend}
            className="rounded-xl bg-[#FF8C00] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e07b00] transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  )
}
