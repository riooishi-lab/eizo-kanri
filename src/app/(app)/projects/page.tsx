'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/types/project'
import { PROJECT_STATUS_COLORS } from '@/types/project'
import KanbanBoard from '@/components/projects/KanbanBoard'
import ProjectListView from '@/components/projects/ProjectListView'
import {
  LayoutGrid, List, Plus, Search,
  TrendingUp, TrendingDown, AlertTriangle, CalendarX, X,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts'

type ViewMode  = 'kanban' | 'list'
type GanttSort = 'created' | 'final' | 'first_draft' | 'days_left'

// ── 作業種別カラー ─────────────────────────────────────────────────────────
const WORK_TYPE_COLORS: Record<string, string> = {
  企画:   '#6366f1',
  撮影:   '#f59e0b',
  編集:   '#10b981',
  段取り: '#8b5cf6',
  打合せ: '#3b82f6',
  その他: '#94a3b8',
}

// ── ガントチャート 定数 ────────────────────────────────────────────────────
const G_BEFORE = 30
const G_AFTER  = 30
const G_TOTAL  = G_BEFORE + G_AFTER + 1   // 61日
const DAY_W    = 28                        // 1列の幅 (px)
const LEFT_W   = 228                       // 左固定列幅 (px)
const BAR_H    = 10                        // バー高さ (px)
const ROW_H    = 60                        // 行高さ (px)

const SEGMENTS: Array<{ key: keyof Project; label: string; color: string }> = [
  { key: 'storyboard_date',  label: 'コンテ', color: '#3B82F6' },
  { key: 'schedule_date',    label: '香盤',   color: '#F59E0B' },
  { key: 'shooting_date',    label: '撮影',   color: '#F97316' },
  { key: 'first_draft_date', label: '初稿',   color: '#8B5CF6' },
  { key: 'final_date',       label: '校了',   color: '#EF4444' },
]

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']

// ── ユーティリティ ─────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayDiff(dateStr: string, todayStr: string): number {
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86_400_000)
}

function msTooltip(label: string, dateStr: string, todayStr: string): string {
  const diff = dayDiff(dateStr, todayStr)
  const disp = dateStr.slice(5).replace('-', '/')
  if (diff < 0)   return `${label}（${disp}）: 済み`
  if (diff === 0) return `${label}（${disp}）: 今日！`
  return `${label}（${disp}）: 残り${diff}日`
}

// ── HP バー用セグメント計算 ────────────────────────────────────────────────
type BarSegment = { relStart: number; relEnd: number; color: string }

function buildBarSegments(
  p: Project, dayStrs: string[],
): { barLeft: number; barRight: number; segments: BarSegment[] } | null {
  const totalW = G_TOTAL * DAY_W

  function xForDate(dateStr: string): number {
    if (dateStr <= dayStrs[0]) return 0
    if (dateStr >= dayStrs[dayStrs.length - 1]) return totalW
    const idx = dayStrs.indexOf(dateStr)
    return idx !== -1 ? idx * DAY_W : 0
  }

  const definedMs = SEGMENTS
    .filter(ms => p[ms.key] != null)
    .map(ms => ({ date: p[ms.key] as string, color: ms.color }))

  if (definedMs.length < 2) return null

  const rawSegs: Array<{ startX: number; endX: number; color: string }> = []
  for (let i = 0; i < definedMs.length - 1; i++) {
    const startX = xForDate(definedMs[i].date)
    const endX   = xForDate(definedMs[i + 1].date) + DAY_W
    if (endX <= 0 || startX >= totalW) continue
    rawSegs.push({ startX: Math.max(0, startX), endX: Math.min(totalW, endX), color: definedMs[i + 1].color })
  }

  if (rawSegs.length === 0) return null

  const barLeft  = rawSegs[0].startX
  const barRight = rawSegs[rawSegs.length - 1].endX
  return {
    barLeft, barRight,
    segments: rawSegs.map(s => ({ relStart: s.startX - barLeft, relEnd: s.endX - barLeft, color: s.color })),
  }
}

// ── 分析用型 ──────────────────────────────────────────────────────────────
type WorkLog    = { id: string; project_id: string | null; date: string; work_type: string; hours: number | null }
type MonthlyLog = { date: string; work_type: string; hours: number | null }
type ProjectRow = { id: string; project_name: string; estimated_hours: number | null; actual_hours: number | null }

function thisMonthRange() {
  const now = new Date()
  return { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtDate(now) }
}
function lastMonthRange() {
  const now = new Date()
  return {
    from: fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to:   fmtDate(new Date(now.getFullYear(), now.getMonth(), 0)),
  }
}

// ════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const supabase = createClient()

  const [projects, setProjects]       = useState<Project[]>([])
  const [loading, setLoading]         = useState(true)
  const [viewMode, setViewMode]       = useState<ViewMode>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [ganttSort, setGanttSort]     = useState<GanttSort>('created')

  const [workLogs, setWorkLogs]                   = useState<WorkLog[]>([])
  const [sixMonthLogs, setSixMonthLogs]           = useState<MonthlyLog[]>([])
  const [analyticsProjects, setAnalyticsProjects] = useState<ProjectRow[]>([])
  const [lastMonthTotal, setLastMonthTotal]       = useState(0)
  const [analyticsLoading, setAnalyticsLoading]   = useState(true)
  const [dismissedAlerts, setDismissedAlerts]     = useState<Set<string>>(new Set())

  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { fetchAnalytics() }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (!error && data) setProjects(data as Project[])
    setLoading(false)
  }

  async function fetchAnalytics() {
    setAnalyticsLoading(true)
    const now = new Date()
    const { from, to } = thisMonthRange()
    const last = lastMonthRange()
    const sixMonthsAgo = fmtDate(new Date(now.getFullYear(), now.getMonth() - 5, 1))

    const [logsRes, lastLogsRes, projRes, sixMonthRes] = await Promise.all([
      supabase.from('work_logs').select('id,project_id,date,work_type,hours').gte('date', from).lte('date', to),
      supabase.from('work_logs').select('hours').gte('date', last.from).lte('date', last.to),
      supabase.from('projects').select('id,project_name,estimated_hours,actual_hours').is('deleted_at', null),
      supabase.from('work_logs').select('date,work_type,hours').gte('date', sixMonthsAgo).lte('date', to),
    ])
    setWorkLogs((logsRes.data ?? []) as WorkLog[])
    setLastMonthTotal(((lastLogsRes.data ?? []) as { hours: number | null }[]).reduce((s, l) => s + (l.hours ?? 0), 0))
    setAnalyticsProjects((projRes.data ?? []) as ProjectRow[])
    setSixMonthLogs((sixMonthRes.data ?? []) as MonthlyLog[])
    setAnalyticsLoading(false)
  }

  // ── フィルター ────────────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => projects.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.project_name.toLowerCase().includes(q) ||
      p.company_name.toLowerCase().includes(q) ||
      p.project_no.toLowerCase().includes(q) ||
      (p.production_staff ?? '').toLowerCase().includes(q)
    )
  }), [projects, searchQuery])

  // ── ガント：日付配列 ──────────────────────────────────────────────────────
  const ganttDays = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Array.from({ length: G_TOTAL }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - G_BEFORE + i); return d
    })
  }, [])
  const todayStr   = useMemo(() => fmtDate(new Date()), [])
  const dayStrs    = useMemo(() => ganttDays.map(fmtDate), [ganttDays])
  const todayIdx   = useMemo(() => dayStrs.indexOf(todayStr), [dayStrs, todayStr])
  const todayLineX = todayIdx * DAY_W + DAY_W / 2

  // ── ガント：ソート + フィルター ────────────────────────────────────────────
  const ganttProjects = useMemo(() => {
    const arr = [...projects].filter(p => SEGMENTS.some(ms => p[ms.key] != null))
    switch (ganttSort) {
      case 'final':
        return arr.sort((a, b) => (!a.final_date ? 1 : !b.final_date ? -1 : a.final_date.localeCompare(b.final_date)))
      case 'first_draft':
        return arr.sort((a, b) => (!a.first_draft_date ? 1 : !b.first_draft_date ? -1 : a.first_draft_date.localeCompare(b.first_draft_date)))
      case 'days_left':
        return arr.sort((a, b) => {
          const aD = a.final_date ? dayDiff(a.final_date, todayStr) : Infinity
          const bD = b.final_date ? dayDiff(b.final_date, todayStr) : Infinity
          return aD - bD
        })
      default: return arr
    }
  }, [projects, ganttSort, todayStr])

  // ── 締切アラート ──────────────────────────────────────────────────────────
  type DeadlineAlert = { id: string; level: 'red' | 'orange' | 'yellow'; message: string; href: string }

  const deadlineAlerts = useMemo((): DeadlineAlert[] => {
    const alerts: DeadlineAlert[] = []
    for (const p of projects) {
      if (p.final_date) {
        const diff = dayDiff(p.final_date, todayStr)
        if (diff <= 3) {
          alerts.push({ id: `final-3-${p.id}`, level: 'red',
            message: `【${p.company_name}】${p.project_name} — 校了投稿日まで残り${diff < 0 ? `${Math.abs(diff)}日超過` : diff === 0 ? '今日' : `${diff}日`}`,
            href: `/projects/${p.id}` })
        } else if (diff <= 7) {
          alerts.push({ id: `final-7-${p.id}`, level: 'yellow',
            message: `【${p.company_name}】${p.project_name} — 校了投稿日まで残り${diff}日`,
            href: `/projects/${p.id}` })
        }
      }
      if (p.first_draft_date) {
        const diff = dayDiff(p.first_draft_date, todayStr)
        if (diff >= 0 && diff <= 2) {
          alerts.push({ id: `draft-2-${p.id}`, level: 'orange',
            message: `【${p.company_name}】${p.project_name} — 初稿提出日まで残り${diff === 0 ? '今日' : `${diff}日`}`,
            href: `/projects/${p.id}` })
        }
      }
    }
    const order = { red: 0, orange: 1, yellow: 2 }
    return alerts.filter(a => !dismissedAlerts.has(a.id)).sort((a, b) => order[a.level] - order[b.level])
  }, [projects, todayStr, dismissedAlerts])

  function dismissAlert(id: string) {
    setDismissedAlerts(prev => new Set([...prev, id]))
  }

  // ── 分析集計 ──────────────────────────────────────────────────────────────
  const thisMonthTotal  = useMemo(() => workLogs.reduce((s, l) => s + (l.hours ?? 0), 0), [workLogs])
  const hoursDiff       = thisMonthTotal - lastMonthTotal
  const overBudgetCount = useMemo(() =>
    analyticsProjects.filter(p => p.estimated_hours != null && p.actual_hours != null && p.actual_hours > p.estimated_hours).length,
    [analyticsProjects])
  const unmatchedCount  = useMemo(() => workLogs.filter(l => l.project_id === null).length, [workLogs])

  // ── 過去6ヶ月 作業種別トレンド（折れ線グラフ用）────────────────────────────
  const lineChartData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      return {
        month:     `${d.getMonth() + 1}月`,
        yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      }
    })
    return months.map(({ month, yearMonth }) => {
      const entry: Record<string, number | string> = { month }
      for (const wt of Object.keys(WORK_TYPE_COLORS)) {
        entry[wt] = Math.round(
          sixMonthLogs
            .filter(l => l.date.startsWith(yearMonth) && (l.work_type || 'その他') === wt)
            .reduce((s, l) => s + (l.hours ?? 0), 0) * 10
        ) / 10
      }
      return entry
    })
  }, [sixMonthLogs])

  // ── 案件別棒グラフ ─────────────────────────────────────────────────────────
  const projectBarData = useMemo(() => {
    const actualMap: Record<string, number> = {}
    for (const l of workLogs) { if (l.project_id) actualMap[l.project_id] = (actualMap[l.project_id] ?? 0) + (l.hours ?? 0) }
    return analyticsProjects
      .filter(p => actualMap[p.id] != null || (p.actual_hours ?? 0) > 0)
      .map(p => {
        const actual    = Math.round((actualMap[p.id] ?? p.actual_hours ?? 0) * 10) / 10
        const estimated = p.estimated_hours ?? 0
        return {
          name: p.project_name.length > 10 ? p.project_name.slice(0, 10) + '…' : p.project_name,
          実工数: actual, 予測工数: estimated,
          over: estimated > 0 && actual > estimated * 1.2,
        }
      })
      .sort((a, b) => b.実工数 - a.実工数).slice(0, 10)
  }, [workLogs, analyticsProjects])

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ── ツールバー（スクロール追従） ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="案件名・会社名で検索..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['kanban', 'list'] as ViewMode[]).map(vm => (
              <button key={vm} onClick={() => setViewMode(vm)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${viewMode === vm ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {vm === 'kanban' ? <><LayoutGrid className="w-4 h-4" />カンバン</> : <><List className="w-4 h-4" />リスト</>}
              </button>
            ))}
          </div>
          <Link href="/projects/new">
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />新規案件
            </button>
          </Link>
        </div>
      </div>

      {/* ── 締切アラート ── */}
      {deadlineAlerts.length > 0 && (
        <div className="px-6 pt-3 pb-1 flex flex-col gap-1.5">
          {deadlineAlerts.map(alert => {
            const styles = {
              red:    'bg-red-50 border-red-200 text-red-800',
              orange: 'bg-orange-50 border-orange-200 text-orange-800',
              yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            }[alert.level]
            const icon = { red: '🔴', orange: '🟠', yellow: '🟡' }[alert.level]
            return (
              <div key={alert.id} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${styles}`}>
                <span>{icon}</span>
                <Link href={alert.href} className="flex-1 hover:underline truncate">{alert.message}</Link>
                <button onClick={() => dismissAlert(alert.id)}
                  className="shrink-0 opacity-50 hover:opacity-100 transition-opacity" aria-label="閉じる">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── カンバン / リスト ── */}
      <div className="px-6 pt-4 pb-8">
        <p className="text-sm text-slate-500 mb-4">
          {loading ? '読み込み中...' : `${filteredProjects.length} 件の案件`}
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard projects={filteredProjects} />
        ) : (
          <ProjectListView projects={filteredProjects} />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ガントチャート（HP バー方式）
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-200 bg-white px-6 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">スケジュール（±30日）</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ソートボタン */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">ソート：</span>
          {([
            ['created',    '登録順'],
            ['final',      '納期順'],
            ['first_draft','初稿順'],
            ['days_left',  '残り日数順'],
          ] as [GanttSort, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setGanttSort(val)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                ganttSort === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
          {SEGMENTS.map(s => (
            <div key={s.key as string} className="flex items-center gap-1.5">
              <div className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-slate-500">{s.label}まで</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3.5 bg-red-500 rounded" />
            <span className="text-xs text-slate-500">今日</span>
          </div>
        </div>

        {/* テーブル本体 */}
        {!loading && (
          <div
            className="border border-slate-200 rounded-xl overflow-auto bg-white"
            style={{ minHeight: 400 }}
          >
            <table
              className="border-collapse"
              style={{ tableLayout: 'fixed', minWidth: LEFT_W + G_TOTAL * DAY_W }}
            >
              <thead>
                <tr className="bg-slate-50">
                  <th
                    className="border-b border-r border-slate-200 bg-slate-50 text-left px-3 py-2
                      text-xs font-semibold text-slate-600"
                    style={{ width: LEFT_W, minWidth: LEFT_W, position: 'sticky', left: 0, top: 0, zIndex: 50 }}
                  >
                    案件
                  </th>
                  {ganttDays.map((day, i) => {
                    const isToday   = i === todayIdx
                    const isMon     = day.getDay() === 1
                    const is1st     = day.getDate() === 1
                    const showLabel = isToday || isMon || is1st
                    return (
                      <th
                        key={i}
                        className={`border-b border-slate-200 text-center select-none ${
                          isToday ? 'bg-rose-50 border-x-2 border-x-rose-400' : 'bg-slate-50'
                        }`}
                        style={{ width: DAY_W, minWidth: DAY_W, padding: '2px 0', position: 'sticky', top: 0, zIndex: 20 }}
                      >
                        {showLabel ? (
                          <div className="flex flex-col items-center leading-none">
                            <span className={`text-[9px] font-semibold ${
                              isToday ? 'text-rose-600' : is1st ? 'text-indigo-600' : 'text-slate-400'
                            }`}>
                              {isToday ? '今日' : `${day.getMonth() + 1}/${day.getDate()}`}
                            </span>
                            <span className={`text-[8px] ${
                              day.getDay() === 0 ? 'text-red-400' :
                              day.getDay() === 6 ? 'text-blue-400' : 'text-slate-300'
                            }`}>
                              {DOW_JA[day.getDay()]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-300">{day.getDate()}</span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {ganttProjects.length === 0 ? (
                  <tr>
                    <td colSpan={G_TOTAL + 1} className="text-center text-sm text-slate-400 py-16">
                      スケジュール情報のある案件なし
                    </td>
                  </tr>
                ) : ganttProjects.map((p, ri) => {
                  const isOverrun   = (p.estimated_hours != null && p.actual_hours != null && p.actual_hours > p.estimated_hours)
                  const isCompleted = p.final_date != null && p.final_date < todayStr
                  const barInfo     = buildBarSegments(p, dayStrs)
                  const rowBg       = ri % 2 === 0 ? '#ffffff' : 'rgba(248,250,252,0.6)'

                  return (
                    <tr key={p.id}>
                      <td
                        className="border-b border-r border-slate-100 px-3 py-2"
                        style={{ position: 'sticky', left: 0, zIndex: 10, background: rowBg, width: LEFT_W, minWidth: LEFT_W }}
                      >
                        <Link href={`/projects/${p.id}`} className="block hover:opacity-80">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-medium text-slate-900 truncate leading-tight flex-1">{p.project_name}</p>
                            {isOverrun && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-600 border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5" />工数超過
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate leading-tight">{p.company_name}</p>
                        </Link>
                        <span className={`inline-flex items-center mt-0.5 px-1.5 py-px rounded-full text-[9px] font-medium border ${PROJECT_STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                      </td>

                      <td colSpan={G_TOTAL} style={{ padding: 0, height: ROW_H, background: rowBg }}>
                        <div style={{ position: 'relative', width: G_TOTAL * DAY_W, height: ROW_H }}>
                          {ganttDays.map((day, di) => {
                            const isSat   = day.getDay() === 6
                            const isSun   = day.getDay() === 0
                            const isToday = di === todayIdx
                            if (!isSat && !isSun && !isToday) return null
                            return (
                              <div key={di} style={{
                                position: 'absolute', left: di * DAY_W, width: DAY_W,
                                top: 0, bottom: 0, pointerEvents: 'none',
                                backgroundColor: isToday ? 'rgba(239,68,68,0.07)'
                                  : isSat ? 'rgba(59,130,246,0.04)' : 'rgba(239,68,68,0.03)',
                              }} />
                            )
                          })}

                          {barInfo && (
                            <div className={isOverrun ? 'animate-pulse' : ''} style={{ opacity: isCompleted ? 0.4 : 1 }}>
                              <div style={{
                                position: 'absolute', left: barInfo.barLeft,
                                width: barInfo.barRight - barInfo.barLeft,
                                top: (ROW_H - BAR_H) / 2, height: BAR_H,
                                borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                              }}>
                                {barInfo.segments.flatMap((seg, si) => {
                                  const relSplit    = todayLineX - barInfo.barLeft
                                  const pastWidth   = Math.max(0, Math.min(seg.relEnd, relSplit) - seg.relStart)
                                  const futureLeft  = Math.max(seg.relStart, relSplit)
                                  const futureWidth = Math.max(0, seg.relEnd - futureLeft)
                                  const els: React.ReactNode[] = []
                                  if (pastWidth > 0) els.push(<div key={`p-${si}`} style={{ position: 'absolute', left: seg.relStart, width: pastWidth, top: 0, bottom: 0, backgroundColor: seg.color }} />)
                                  if (futureWidth > 0) els.push(<div key={`f-${si}`} style={{ position: 'absolute', left: futureLeft, width: futureWidth, top: 0, bottom: 0, backgroundColor: seg.color, opacity: 0.28 }} />)
                                  if (si < barInfo.segments.length - 1) els.push(<div key={`d-${si}`} style={{ position: 'absolute', left: seg.relEnd - 0.5, width: 1, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.55)' }} />)
                                  return els
                                })}
                              </div>
                              {isOverrun && (
                                <div style={{ position: 'absolute', left: Math.max(barInfo.barLeft, barInfo.barRight - 20), top: (ROW_H - BAR_H) / 2 - 12, zIndex: 6 }}>
                                  <AlertTriangle style={{ width: 11, height: 11, color: '#EF4444' }} />
                                </div>
                              )}
                            </div>
                          )}

                          {SEGMENTS.map(ms => {
                            const date = p[ms.key] as string | null
                            if (!date) return null
                            const di = dayStrs.indexOf(date)
                            if (di === -1) return null
                            const x = di * DAY_W + DAY_W / 2
                            const isPast = date < todayStr
                            return (
                              <div key={ms.key as string} title={msTooltip(ms.label, date, todayStr)} style={{
                                position: 'absolute', left: x - 5, top: (ROW_H - BAR_H) / 2 - 2,
                                width: 10, height: 10, borderRadius: '50%', backgroundColor: ms.color,
                                border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                opacity: isPast ? 0.5 : 1, zIndex: 4, cursor: 'help',
                              }} />
                            )
                          })}

                          <div style={{
                            position: 'absolute', left: todayLineX - 1, width: 2,
                            top: '8%', bottom: '8%', backgroundColor: '#EF4444', borderRadius: 1, zIndex: 5,
                          }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          工数ダッシュボード
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 pt-6 pb-12" style={{ minHeight: 500 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">工数ダッシュボード（今月）</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 4 カード */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-center w-8 h-8 bg-indigo-50 rounded-lg mb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-xs text-slate-500">今月の合計工数</p>
                <p className="text-xl font-bold text-slate-900">{thisMonthTotal.toFixed(1)} h</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${hoursDiff >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {hoursDiff >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
                </div>
                <p className="text-xs text-slate-500">先月比</p>
                <p className={`text-xl font-bold ${hoursDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {hoursDiff >= 0 ? '+' : ''}{hoursDiff.toFixed(1)} h
                </p>
                <p className="text-xs text-slate-400">先月: {lastMonthTotal.toFixed(1)} h</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-center w-8 h-8 bg-amber-50 rounded-lg mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs text-slate-500">工数超過中の案件</p>
                <p className="text-xl font-bold text-slate-900">{overBudgetCount} 件</p>
                <p className="text-xs text-slate-400">実工数 &gt; 予測工数</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg mb-2">
                  <CalendarX className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-xs text-slate-500">未マッチの予定</p>
                <p className="text-xl font-bold text-slate-900">{unmatchedCount} 件</p>
                <p className="text-xs text-slate-400">案件と紐づかない予定</p>
              </div>
            </div>

            {/* 2 グラフ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 折れ線グラフ：作業種別トレンド（過去6ヶ月） */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">作業種別トレンド（過去6ヶ月）</h3>
                {sixMonthLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-16">データなし</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={lineChartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="h" width={40} />
                      <ReTooltip formatter={(v: number | undefined) => [`${v ?? 0} h`, '']} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {Object.entries(WORK_TYPE_COLORS).map(([wt, color]) => (
                        <Line
                          key={wt}
                          type="monotone"
                          dataKey={wt}
                          stroke={color}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* 棒グラフ：案件別工数 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">案件別 実工数 vs 予測工数</h3>
                {projectBarData.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-16">今月のデータなし</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={projectBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <ReTooltip formatter={(v: number | undefined) => [`${v ?? 0} h`, '']} />
                        <Legend />
                        <Bar dataKey="予測工数" fill="#e2e8f0" radius={[0, 2, 2, 0]} />
                        <Bar dataKey="実工数" radius={[0, 2, 2, 0]}>
                          {projectBarData.map((e, i) => <Cell key={i} fill={e.over ? '#ef4444' : '#6366f1'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />
                      予測工数×1.2超過は赤表示
                    </p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
