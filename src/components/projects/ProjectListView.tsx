'use client'

import { useState, useMemo } from 'react'
import type { Project, ProjectPriority } from '@/types/project'
import { PROJECT_STATUSES } from '@/types/project'
import { StatusBadge, PriorityBadge } from './StatusBadge'
import { ColumnFilter } from '@/components/ui/ColumnFilter'
import Link from 'next/link'
import { ChevronRight, Filter } from 'lucide-react'

interface ProjectListViewProps {
  projects: Project[]
}

type ColumnKey = 'status' | 'priority' | 'company_name' | 'production_staff'

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

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  must: 'MUST',
  should: 'SHOULD',
  want: 'WANT',
}

const EMPTY_FILTERS: Record<ColumnKey, Set<string>> = {
  status: new Set(),
  priority: new Set(),
  company_name: new Set(),
  production_staff: new Set(),
}

export default function ProjectListView({ projects }: ProjectListViewProps) {
  const [filters, setFilters] = useState<Record<ColumnKey, Set<string>>>(EMPTY_FILTERS)
  const [openColumn, setOpenColumn] = useState<ColumnKey | null>(null)

  const columnOptions = useMemo(() => ({
    status: [...PROJECT_STATUSES] as string[],
    priority: ['MUST', 'SHOULD', 'WANT'] as string[],
    company_name: [...new Set(projects.map(p => p.company_name).filter(Boolean))].sort(),
    production_staff: [...new Set(projects.map(p => p.production_staff ?? '（未設定）'))].sort(),
  }), [projects])

  function toggleFilter(col: ColumnKey, val: string) {
    setFilters(prev => {
      const next = new Set(prev[col])
      next.has(val) ? next.delete(val) : next.add(val)
      return { ...prev, [col]: next }
    })
  }

  function toggleColumn(col: ColumnKey) {
    setOpenColumn(prev => (prev === col ? null : col))
  }

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filters.status.size > 0 && !filters.status.has(p.status)) return false
      if (filters.priority.size > 0 && !filters.priority.has(PRIORITY_LABELS[p.priority])) return false
      if (filters.company_name.size > 0 && !filters.company_name.has(p.company_name)) return false
      if (filters.production_staff.size > 0) {
        const staff = p.production_staff ?? '（未設定）'
        if (!filters.production_staff.has(staff)) return false
      }
      return true
    })
  }, [projects, filters])

  const isFiltered = Object.values(filters).some(s => s.size > 0)

  function FilterTh({ col, label }: { col: ColumnKey; label: string }) {
    return (
      <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">
        <ColumnFilter
          label={label}
          options={columnOptions[col]}
          selected={filters[col]}
          isOpen={openColumn === col}
          onToggle={() => toggleColumn(col)}
          onChange={val => toggleFilter(col, val)}
          onClose={() => setOpenColumn(null)}
        />
      </th>
    )
  }

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
      {isFiltered && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
          <Filter className="w-3 h-3" />
          <span>フィルター適用中 — {filteredProjects.length} / {projects.length} 件表示</span>
          <button
            onClick={() => setFilters({ status: new Set(), priority: new Set(), company_name: new Set(), production_staff: new Set() })}
            className="ml-auto text-indigo-500 hover:text-indigo-700 underline"
          >
            クリア
          </button>
        </div>
      )}
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">案件No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">案件名</th>
              <FilterTh col="company_name" label="会社名" />
              <FilterTh col="status" label="ステータス" />
              <FilterTh col="priority" label="優先度" />
              <FilterTh col="production_staff" label="制作担当" />
              <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">撮影日</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">予算</th>
              <th className="px-4 py-3 bg-slate-50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                  条件に一致する案件がありません
                </td>
              </tr>
            ) : (
              filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{project.project_no}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{project.project_name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{project.company_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={project.priority} /></td>
                  <td className="px-4 py-3 text-slate-600">{project.production_staff || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(project.shooting_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(project.budget)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${project.id}`}>
                      <ChevronRight className="w-4 h-4 text-slate-400 hover:text-indigo-600 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
