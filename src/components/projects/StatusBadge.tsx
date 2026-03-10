import { PROJECT_STATUS_COLORS, PROJECT_PRIORITY_COLORS, type ProjectStatus, type ProjectPriority } from '@/types/project'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PROJECT_STATUS_COLORS[status]}`}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  const labels: Record<ProjectPriority, string> = {
    must: 'MUST',
    should: 'SHOULD',
    want: 'WANT',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PROJECT_PRIORITY_COLORS[priority]}`}>
      {labels[priority]}
    </span>
  )
}
