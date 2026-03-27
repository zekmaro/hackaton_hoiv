import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

export default function Tutor() {
  const { subject } = useParams<{ subject: string }>()
  const title = useMemo(() => subject ?? 'general', [subject])

  return (
    <main className="min-h-screen bg-background px-6 py-20 text-foreground">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-display tracking-tight">Tutor: {title}</h1>
        <p className="mt-4 text-muted-foreground">
          Tutor route is connected and can now be linked to voice/session APIs.
        </p>
      </div>
    </main>
  )
}
