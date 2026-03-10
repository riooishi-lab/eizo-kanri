'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, CalendarX } from 'lucide-react'

// ── 定数 ──────────────────────────────────────────────────────────────────
type Period = 'week' | 'month' | '3months'
type TrendView = 'weekly' | 'monthly'

const WORK_TYPE_COLORS: Record<string, string> = {
  企画:   '#6366f1',
  撮影:   '#f59e0b',
  編集:   '#10b981',
  段取り: '#8b5cf6',
  打合せ: '#3b82f6',
  その他: '#94a3b8',
}
const WORK_TYPES = Object.keys(WORK_TYPE_COLORS)

// ── 型 ────────────────────────────────────────────────────────────────────
type WorkLog = {
  id: string
  project_id: string | null
  date: string
  work_type: string
  hours: number | null
  staff: string | null
  project_name: string | null
  company_name: string | null
}

type ProjectRow = {
  id: string
  project_name: string
  company_name: string | null
  estimated_hours: number | null
  actual_hours: number | null
}

// ── 期間ヘルパー ─────────────────────────────────────────────────────────
function getPeriodRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const to = fmt(now)

  if (period === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0
    const from = new Date(now); from.setDate(now.getDate() - day)
    return { from: fmt(from), to }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(from), to }
  }
  // 3months
  const from = new Date(now); from.setMonth(now.getMonth() - 3)
  return { from: fmt(from), to }
}

function getLastMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to   = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(to) }
}

// ── 週ラベル ──────────────────────────────────────────────────────────────
function weekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  const mon = new Date(d); mon.setDate(d.getDate() - day)
  return `${mon.getMonth() + 1}/${mon.getDate()}週`
}

function monthLabel(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}

// ── サマリーカード ────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, icon, color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [period, setPeriod]         = useState<Period>('month')
  const [trendView, setTrendView]   = useState<TrendView>('weekly')
  const [logs, setLogs]             = useState<WorkLog[]>([])
  const [allLogs, setAllLogs]       = useState<WorkLog[]>([]) // 先月比用
  const [projects, setProjects]     = useState<ProjectRow[]>([])
  const [loading, setLoading]       = useState(true)

  // ── データ取得 ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { from, to } = getPeriodRange(period)
      const last = getLastMonthRange()

      const [logsRes, allLogsRes, projectsRes] = await Promise.all([
        supabase.from('work_logs')
          .select('id,project_id,date,work_type,hours,staff,project_name,company_name')
          .gte('date', from).lte('date', to),
        supabase.from('work_logs')
          .select('id,date,hours')
          .gte('date', last.from).lte('date', last.to),
        supabase.from('projects')
          .select('id,project_name,company_name,estimated_hours,actual_hours')
          .is('deleted_at', null),
      ])

      setLogs((logsRes.data ?? []) as WorkLog[])
      setAllLogs((allLogsRes.data ?? []) as WorkLog[])
      setProjects((projectsRes.data ?? []) as ProjectRow[])
      setLoading(false)
    }
    load()
  }, [period])

  // ── 集計 ───────────────────────────────────────────────────────────────
  const thisMonthHours = useMemo(
    () => logs.reduce((s, l) => s + (l.hours ?? 0), 0),
    [logs]
  )
  const lastMonthHours = useMemo(
    () => allLogs.reduce((s, l) => s + (l.hours ?? 0), 0),
    [allLogs]
  )
  const hoursDiff = thisMonthHours - lastMonthHours

  const overBudgetCount = useMemo(
    () => projects.filter(p =>
      p.estimated_hours != null && p.actual_hours != null &&
      p.actual_hours > p.estimated_hours
    ).length,
    [projects]
  )

  const unmatchedCount = useMemo(
    () => logs.filter(l => l.project_id === null).length,
    [logs]
  )

  // ① 作業種別ドーナツ
  const donutData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of logs) {
      const wt = l.work_type || 'その他'
      map[wt] = (map[wt] ?? 0) + (l.hours ?? 0)
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
  }, [logs])

  // ② 案件別比較
  const projectBarData = useMemo(() => {
    const actualMap: Record<string, number> = {}
    for (const l of logs) {
      if (!l.project_id) continue
      actualMap[l.project_id] = (actualMap[l.project_id] ?? 0) + (l.hours ?? 0)
    }
    return projects
      .filter(p => actualMap[p.id] != null || (p.actual_hours ?? 0) > 0)
      .map(p => {
        const actual    = Math.round((actualMap[p.id] ?? p.actual_hours ?? 0) * 10) / 10
        const estimated = p.estimated_hours ?? 0
        const over      = estimated > 0 && actual > estimated * 1.2
        return {
          name:      p.project_name.length > 10 ? p.project_name.slice(0, 10) + '…' : p.project_name,
          実工数:    actual,
          予測工数:  estimated,
          over,
        }
      })
      .sort((a, b) => b.実工数 - a.実工数)
      .slice(0, 12)
  }, [logs, projects])

  // ③ 担当者別積み上げ
  const staffData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const l of logs) {
      const staff = l.staff || '未設定'
      const wt    = l.work_type || 'その他'
      if (!map[staff]) map[staff] = {}
      map[staff][wt] = (map[staff][wt] ?? 0) + (l.hours ?? 0)
    }
    type StaffRow = Record<string, string | number>
    return Object.entries(map)
      .map(([staff, wtMap]): StaffRow => ({
        staff: staff.length > 8 ? staff.slice(0, 8) + '…' : staff,
        ...Object.fromEntries(
          Object.entries(wtMap).map(([k, v]) => [k, Math.round(v * 10) / 10])
        ),
      }))
      .sort((a, b) => {
        const sumA = WORK_TYPES.reduce((s, wt) => s + ((a[wt] as number) ?? 0), 0)
        const sumB = WORK_TYPES.reduce((s, wt) => s + ((b[wt] as number) ?? 0), 0)
        return sumB - sumA
      })
  }, [logs])

  // ④ 工数推移折れ線
  const trendData = useMemo(() => {
    const label = trendView === 'weekly' ? weekLabel : monthLabel
    const map: Record<string, number> = {}
    for (const l of logs) {
      const key = label(l.date)
      map[key] = (map[key] ?? 0) + (l.hours ?? 0)
    }
    return Object.entries(map)
      .map(([key, value]) => ({ key, 合計工数: Math.round(value * 10) / 10 }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [logs, trendView])

  // ── レンダリング ────────────────────────────────────────────────────────
  const periodLabels: Record<Period, string> = {
    week: '今週', month: '今月', '3months': '過去3ヶ月',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">工数分析</h1>

        {/* 期間フィルター */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {(['week', 'month', '3months'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-24">読み込み中...</div>
      ) : (
        <>
          {/* ── サマリーカード ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label={`${periodLabels[period]}の合計工数`}
              value={`${thisMonthHours.toFixed(1)} h`}
              icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
              color="bg-indigo-50"
            />
            <SummaryCard
              label="先月比"
              value={`${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(1)} h`}
              sub={`先月: ${lastMonthHours.toFixed(1)} h`}
              icon={hoursDiff >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                : <TrendingDown className="w-4 h-4 text-rose-600" />
              }
              color={hoursDiff >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}
            />
            <SummaryCard
              label="工数超過中の案件"
              value={`${overBudgetCount} 件`}
              sub="実工数 > 予測工数"
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              color="bg-amber-50"
            />
            <SummaryCard
              label="未マッチの予定"
              value={`${unmatchedCount} 件`}
              sub="案件と紐づかない予定"
              icon={<CalendarX className="w-4 h-4 text-slate-500" />}
              color="bg-slate-100"
            />
          </div>

          {/* ── グラフ グリッド ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ① 作業種別ドーナツ */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">作業種別の内訳</h2>
              {donutData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">データなし</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        (percent ?? 0) > 0.05 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {donutData.map(entry => (
                        <Cell
                          key={entry.name}
                          fill={WORK_TYPE_COLORS[entry.name] ?? '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <ReTooltip
                      formatter={(v: number | undefined) => [`${v ?? 0} h`, '']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ② 案件別比較棒グラフ */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">案件別 実工数 vs 予測工数</h2>
              {projectBarData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">データなし</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={projectBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <ReTooltip formatter={(v: number | undefined) => [`${v ?? 0} h`, '']} />
                    <Legend />
                    <Bar dataKey="予測工数" fill="#e2e8f0" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="実工数" radius={[0, 2, 2, 0]}>
                      {projectBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.over ? '#ef4444' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-slate-400 mt-2">
                <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />
                予測工数×1.2超過は赤表示
              </p>
            </div>

            {/* ③ 担当者別積み上げ棒グラフ */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">担当者別 作業種別内訳</h2>
              {staffData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">データなし</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={staffData} margin={{ bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="staff" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <ReTooltip formatter={(v: number | undefined) => [`${v ?? 0} h`, '']} />
                    <Legend />
                    {WORK_TYPES.map(wt => (
                      <Bar key={wt} dataKey={wt} stackId="a"
                        fill={WORK_TYPE_COLORS[wt]}
                        radius={wt === WORK_TYPES[WORK_TYPES.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ④ 工数推移折れ線 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">工数推移</h2>
                <div className="flex bg-slate-100 rounded-md p-0.5 gap-0.5">
                  {(['weekly', 'monthly'] as TrendView[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setTrendView(v)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        trendView === v
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {v === 'weekly' ? '週別' : '月別'}
                    </button>
                  ))}
                </div>
              </div>
              {trendData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">データなし</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <ReTooltip formatter={(v: number | undefined) => [`${v ?? 0} h`, '合計工数']} />
                    <Line
                      type="monotone"
                      dataKey="合計工数"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
