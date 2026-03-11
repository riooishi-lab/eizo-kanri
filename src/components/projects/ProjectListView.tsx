'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Project, ProjectPriority } from '@/types/project'
import { PROJECT_STATUSES } from '@/types/project'
import { StatusBadge, PriorityBadge } from './StatusBadge'
import { ColumnFilter } from '@/components/ui/ColumnFilter'
import Link from 'next/link'
import { ChevronRight, Filter, ChevronUp, ChevronDown } from 'lucide-react'

interface ProjectListViewProps {
  projects: Project[]
}

type ColumnKey = 'status' | 'priority' | 'company_name' | 'production_staff'
type SortKey = 'project_no' | 'project_name' | 'company_name' | 'status' | 'priority' | 'production_staff' | 'shooting_date' | 'budget'
type SortDir = 'asc' | 'desc'

const LS_FILTER_KEY = 'projectList_filters'
const LS_SORT_KEY   = 'projectList_sort'

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
const PRIORITY_ORDER: Record<string, number> = { MUST: 0, SHOULD: 1, WANT: 2 }

const EMPTY_FILTERS: Record<ColumnKey, Set<string>> = {
  status: new Set(),
  priority: new Set(),
  company_name: new Set(),
  production_staff: new Set(),
}

function serializeFilters(f: Record<ColumnKey, Set<string>>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, [...v]]))
}
function deserializeFilters(obj: Record<string, string[]>): Record<ColumnKey, Set<string>> {
  return {
    status:           new Set(obj.status ?? []),
    priority:         new Set(obj.priority ?? []),
    company_name:     new Set(obj.company_name ?? []),
    production_staff: new Set(obj.production_staff ?? []),
  }
}

export default function ProjectListView({ projects }: ProjectListViewProps) {
  const [filters, setFilters] = useState<Record<ColumnKey, Set<string>>>(EMPTY_FILTERS)
  const [openColumn, setOpenColumn] = useState<ColumnKey | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('project_no')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // localStorage から復元
  useEffect(() => {
    try {
      const f = localStorage.getItem(LS_FILTER_KEY)
      if (f) setFilters(deserializeFilters(JSON.parse(f)))
      const s = localStorage.getItem(LS_SORT_KEY)
      if (s) { const { key, dir } = JSON.parse(s); setSortKey(key); setSortDir(dir) }
    } catch { /* ignore */ }
  }, [])

  // localStorage に保存
  useEffect(() => {
    localStorage.setItem(LS_FILTER_KEY, JSON.stringify(serializeFilters(filters)))
  }, [filters])
  useEffect(() => {
    localStorage.setItem(LS_SORT_KEY, JSON.stringify({ key: sortKey, dir: sortDir }))
  }, [sortKey, sortDir])

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredProjects = useMemo(() => {
    const arr = projects.filter(p => {
      if (filters.status.size > 0 && !filters.status.has(p.status)) return false
      if (filters.priority.size > 0 && !filters.priority.has(PRIORITY_LABELS[p.priority])) return false
      if (filters.company_name.size > 0 && !filters.company_name.has(p.company_name)) return false
      if (filters.production_staff.size > 0) {
        const staff = p.production_staff ?? '（未設定）'
        if (!filters.production_staff.has(staff)) return false
      }
      return true
    })

    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'project_no':   cmp = a.project_no.localeCompare(b.project_no); break
        case 'project_name': cmp = a.project_name.localeCompare(b.project_name); break
        case 'company_name': cmp = a.company_name.localeCompare(b.company_name); break
        case 'status':       cmp = a.status.localeCompare(b.status); break
        case 'priority':
          cmp = (PRIORITY_ORDER[PRIORITY_LABELS[a.priority]] ?? 99) - (PRIORITY_ORDER[PRIORITY_LABELS[b.priority]] ?? 99); break
        case 'production_staff':
          cmp = (a.production_staff ?? '').localeCompare(b.production_staff ?? ''); break
        case 'shooting_date':
          cmp = (a.shooting_date ?? '').localeCompare(b.shooting_date ?? ''); break
        case 'budget':
          cmp = (a.budget ?? 0) - (b.budget ?? 0); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [projects, filters, sortKey, sortDir])

  const isFiltered = Object.values(filters).some(s => s.size > 0)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-600" />
      : <ChevronDown className="w-3 h-3 text-indigo-600" />
  }

  function SortTh({ col, label, className }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={`text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </div>
      </th>
    )
  }

  function FilterSortTh({ col, sortCol, label }: { col: ColumnKey; sortCol: SortKey; label: string }) {
    return (
      <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs bg-slate-50">
        <div className="flex items-center gap-1">
          <ColumnFilter
            label={label}
            options={columnOptions[col]}
            selected={filters[col]}
            isOpen={openColumn === col}
            onToggle={() => toggleColumn(col)}
            onChange={val => toggleFilter(col, val)}
            onClose={() => setOpenColumn(null)}
          />
          <button onClick={() => handleSort(sortCol)} className="hover:bg-slate-200 rounded p-0.5 transition-colors">
            <SortIcon col={sortCol} />
          </button>
        </div>
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
              <SortTh col="project_no" label="案件No" />
              <SortTh col="project_name" label="案件名" />
              <FilterSortTh col="company_name" sortCol="company_name" label="会社名" />
              <FilterSortTh col="status" sortCol="status" label="ステータス" />
              <FilterSortTh col="priority" sortCol="priority" label="優先度" />
              <FilterSortTh col="production_staff" sortCol="production_staff" label="制作担当" />
              <SortTh col="shooting_date" label="撮影日" />
              <SortTh col="budget" label="予算" />
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
