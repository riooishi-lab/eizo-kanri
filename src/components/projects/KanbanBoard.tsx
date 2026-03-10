import type { Project, ProjectStatus } from '@/types/project'
import { PROJECT_STATUSES, PROJECT_STATUS_HEADER_COLORS } from '@/types/project'
import { StatusBadge, PriorityBadge } from './StatusBadge'
import { Building2, Calendar, User } from 'lucide-react'
import Link from 'next/link'

interface KanbanBoardProps {
  projects: Project[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function KanbanCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-300
        transition-all duration-150 cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs text-slate-400 font-mono">{project.project_no}</span>
          <PriorityBadge priority={project.priority} />
        </div>

        <h3 className="font-medium text-slate-900 text-sm leading-snug mb-1 group-hover:text-indigo-700
          line-clamp-2">
          {project.project_name}
        </h3>

        <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
          <Building2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{project.company_name}</span>
        </div>

        {(project.production_staff || project.shooting_date) && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
            {project.production_staff && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{project.production_staff}</span>
              </div>
            )}
            {project.shooting_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(project.shooting_date)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function KanbanBoard({ projects }: KanbanBoardProps) {
  const byStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PROJECT_STATUSES.map((status) => {
        const items = byStatus(status)
        return (
          <div key={status} className="flex-shrink-0 w-72 flex flex-col">
            {/* カラムヘッダー（固定） */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl shrink-0 ${PROJECT_STATUS_HEADER_COLORS[status]}`}>
              <span className="text-white font-medium text-sm">{status}</span>
              <span className="bg-white/25 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            {/* カード一覧（スクロール） */}
            <div
              className="bg-slate-100 rounded-b-xl p-2 space-y-2 overflow-y-auto"
              style={{ maxHeight: '260px', minHeight: '260px' }}
            >
              {items.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-4">案件なし</p>
              )}
              {items.map((project) => (
                <KanbanCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
