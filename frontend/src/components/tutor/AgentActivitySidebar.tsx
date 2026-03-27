import type { AgentActivity } from '@shared/types'

// Shows live agent reasoning during tutor sessions
// Color coded by agent type — see docs/design-system.md
// New items animate in from the top

const agentColors: Record<AgentActivity['agent'], string> = {
  orchestrator: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  tutor:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  assessment:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  memory:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

interface Props {
  activities: AgentActivity[]
}

export default function AgentActivitySidebar({ activities }: Props) {
  // TODO: animate new items in with Framer Motion (slide down from top)

  return (
    <aside className="w-72 border-l border-slate-100 dark:border-slate-700 p-4 overflow-y-auto bg-white dark:bg-slate-800">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Agent Activity
      </h2>
      {activities.length === 0 ? (
        <p className="text-slate-400 text-xs">Agent reasoning will appear here during sessions.</p>
      ) : (
        <div className="space-y-2">
          {[...activities].reverse().map((a, i) => (
            <div key={i} className={`text-xs px-3 py-2 rounded-lg ${agentColors[a.agent]}`}>
              <span className="font-semibold capitalize">{a.agent}: </span>
              {a.action}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
