import type { RoadmapNode } from '@shared/types'

// Animated horizontal roadmap
// Nodes connected by lines, light up as status changes
// Colors by status/priority — see docs/design-system.md
// Uses Framer Motion for node completion animation

interface Props {
  nodes: RoadmapNode[]
  onNodeClick: (node: RoadmapNode) => void
}

export default function StudyPath({ nodes, onNodeClick }: Props) {
  // TODO: implement
  // - Render nodes horizontally with connecting lines
  // - Color each node by status (locked/available/in_progress/completed)
  // - Animate completed nodes with scale pulse (Framer Motion)
  // - Locked nodes are greyed out and not clickable
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {nodes.map(node => (
        <div
          key={node.id}
          onClick={() => node.status !== 'locked' && onNodeClick(node)}
          className="min-w-40 p-4 rounded-xl border cursor-pointer text-sm"
        >
          <p className="font-medium">{node.topic}</p>
          <p className="text-xs text-slate-400 mt-1">{node.subject}</p>
          <span className="text-xs mt-2 block">{node.status}</span>
        </div>
      ))}
    </div>
  )
}
