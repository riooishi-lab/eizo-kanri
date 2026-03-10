import type { Project } from '@/types/project'
import { StatusBadge, PriorityBadge } from './StatusBadge'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface ProjectListViewProps {
  projects: Project[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—'
  return `¥${amount.toLocaleString()}`
}

export default function ProjectListView({ projects }: ProjectListViewProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-base">案件がありません</p>
        <p className="text-sm mt-1">右上の「新規案件」から登録してください</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">案件No</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">案件名</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">会社名</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">ステータス</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">優先度</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">制作担当</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">撮影日</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">予算</th>
            <th className="px-4 py-3 bg-slate-50"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map((project) => (
            <tr
              key={project.id}
              className="hover:bg-slate-50 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{project.project_no}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-900">{project.project_name}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{project.company_name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={project.status} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={project.priority} />
              </td>
              <td className="px-4 py-3 text-slate-600">{project.production_staff || '—'}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(project.shooting_date)}</td>
              <td className="px-4 py-3 text-slate-600">{formatCurrency(project.budget)}</td>
              <td className="px-4 py-3">
                <Link href={`/projects/${project.id}`}>
                  <ChevronRight className="w-4 h-4 text-slate-400 hover:text-indigo-600 transition-colors" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
