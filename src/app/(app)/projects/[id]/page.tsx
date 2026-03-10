'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_PRIORITY_COLORS,
  type Project,
  type ProjectStatus,
  type ProjectPriority,
} from '@/types/project'
import {
  ChevronLeft, Save, Trash2, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Calendar, User, TrendingUp, DollarSign, Film, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────
// チェックリスト定数
// ─────────────────────────────────────────

const TASK_TEMPLATE = [
  '構成案作成',         // 1
  'コンテ提出',         // 2
  '香盤表作成',         // 3
  'キャスティング連絡', // 4
  'ロケ地手配',         // 5
  '撮影',               // 6
  'データ整理',         // 7
  'カット編集',         // 8
  'インサート編集',     // 9
  'テロップ作成',       // 10
  'BGM選定',            // 11
  '初稿提出',           // 12
  '修正対応',           // 13
  '校了',               // 14
] as const

const PHASE_GROUPS = [
  { label: '企画', indices: [1, 2, 3, 4, 5] },
  { label: '撮影', indices: [6, 7] },
  { label: '編集', indices: [8, 9, 10, 11, 12, 13, 14] },
] as const

type PhaseLabel = '企画' | '撮影' | '編集'

const PHASE_COLORS: Record<PhaseLabel, string> = {
  企画: 'text-indigo-600 bg-indigo-50',
  撮影: 'text-blue-600 bg-blue-50',
  編集: 'text-violet-600 bg-violet-50',
}

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

interface TaskRow {
  id: string
  project_id: string
  task_index: number
  label: string
  is_done: boolean
  done_at: string | null
}

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────

function toNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}
function toDate(val: string): string | null { return val === '' ? null : val }
function numStr(val: number | null | undefined): string { return val == null ? '' : String(val) }
function dateStr(val: string | null | undefined): string { return val ?? '' }

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  return `¥${val.toLocaleString()}`
}
function formatHours(val: number | null): string {
  if (val == null) return '—'
  return `${val}h`
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────
// 工程進捗の計算（チェックリスト連動）
// ─────────────────────────────────────────

function calcPhaseProgress(tasks: TaskRow[]) {
  if (tasks.length === 0) return { planning: 0, shooting: 0, editing: 0 }
  const done = new Set(tasks.filter((t) => t.is_done).map((t) => t.task_index))
  const pct = (indices: readonly number[]) =>
    Math.round((indices.filter((i) => done.has(i)).length / indices.length) * 100)
  return {
    planning: pct(PHASE_GROUPS[0].indices),
    shooting: pct(PHASE_GROUPS[1].indices),
    editing:  pct(PHASE_GROUPS[2].indices),
  }
}

// ─────────────────────────────────────────
// フォーム型
// ─────────────────────────────────────────

interface FormData {
  company_name: string; project_name: string; production_staff: string; sales_staff: string
  status: ProjectStatus; priority: ProjectPriority; description: string
  budget: string; cost: string; estimated_hours: string; actual_hours: string
  planning_hours: string; shooting_hours: string; editing_hours: string
  storyboard_date: string; schedule_date: string; shooting_date: string
  first_draft_date: string; final_date: string; notes: string
}

function projectToForm(p: Project): FormData {
  return {
    company_name: p.company_name, project_name: p.project_name,
    production_staff: p.production_staff ?? '', sales_staff: p.sales_staff ?? '',
    status: p.status, priority: p.priority, description: p.description ?? '',
    budget: numStr(p.budget), cost: numStr(p.cost),
    estimated_hours: numStr(p.estimated_hours), actual_hours: numStr(p.actual_hours),
    planning_hours: numStr(p.planning_hours), shooting_hours: numStr(p.shooting_hours),
    editing_hours: numStr(p.editing_hours),
    storyboard_date: dateStr(p.storyboard_date), schedule_date: dateStr(p.schedule_date),
    shooting_date: dateStr(p.shooting_date), first_draft_date: dateStr(p.first_draft_date),
    final_date: dateStr(p.final_date), notes: p.notes ?? '',
  }
}

function formToPayload(form: FormData) {
  return {
    company_name: form.company_name.trim(), project_name: form.project_name.trim(),
    production_staff: form.production_staff.trim() || null,
    sales_staff: form.sales_staff.trim() || null,
    status: form.status, priority: form.priority,
    description: form.description.trim() || null,
    budget: toNum(form.budget), cost: toNum(form.cost),
    estimated_hours: toNum(form.estimated_hours), actual_hours: toNum(form.actual_hours),
    planning_hours: toNum(form.planning_hours), shooting_hours: toNum(form.shooting_hours),
    editing_hours: toNum(form.editing_hours),
    storyboard_date: toDate(form.storyboard_date), schedule_date: toDate(form.schedule_date),
    shooting_date: toDate(form.shooting_date), first_draft_date: toDate(form.first_draft_date),
    final_date: toDate(form.final_date), notes: form.notes.trim() || null,
  }
}

function diffProject(before: Project, afterPayload: ReturnType<typeof formToPayload>) {
  const beforeData: Record<string, unknown> = {}
  const afterData: Record<string, unknown> = {}
  for (const key of Object.keys(afterPayload) as Array<keyof typeof afterPayload>) {
    const prev = (before as unknown as Record<string, unknown>)[key]
    const next = afterPayload[key]
    if (String(prev ?? null) !== String(next ?? null)) {
      beforeData[key] = prev ?? null
      afterData[key] = next ?? null
    }
  }
  return { beforeData, afterData }
}

// ─────────────────────────────────────────
// 共通フォームパーツ
// ─────────────────────────────────────────

const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400'
const selectCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const textareaCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 resize-none'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{children}</h2>
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────
// 進捗バー UI
// ─────────────────────────────────────────

type PhaseState = 'done' | 'active' | 'pending'

function phaseState(pct: number): PhaseState {
  if (pct >= 100) return 'done'
  if (pct > 0)    return 'active'
  return 'pending'
}

function ProgressBar({ pct, state }: { pct: number; state: PhaseState }) {
  const bar = state === 'done' ? 'bg-green-500' : state === 'active' ? 'bg-indigo-500' : 'bg-slate-200'
  const bg  = state === 'done' ? 'bg-green-100' : state === 'active' ? 'bg-indigo-100' : 'bg-slate-100'
  return (
    <div className={`h-2 rounded-full ${bg} overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

function PhaseLabel({ state, pct }: { state: PhaseState; pct: number }) {
  if (state === 'done')   return <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />完了</span>
  if (state === 'active') return <span className="text-xs text-indigo-600 font-medium">{pct}%</span>
  return <span className="text-xs text-slate-400">未着手</span>
}

// ─────────────────────────────────────────
// タイムライン
// ─────────────────────────────────────────

type MilestoneStatus = 'done' | 'today' | 'soon' | 'future' | 'unset'

function getMilestoneStatus(ds: string | null): { status: MilestoneStatus; daysLeft: number } {
  if (!ds) return { status: 'unset', daysLeft: 0 }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(ds); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0)   return { status: 'done',   daysLeft: diff }
  if (diff === 0) return { status: 'today',  daysLeft: 0 }
  if (diff <= 7)  return { status: 'soon',   daysLeft: diff }
  return            { status: 'future', daysLeft: diff }
}

function MilestoneChip({ label, date }: { label: string; date: string | null }) {
  const { status, daysLeft } = getMilestoneStatus(date)
  const styles = {
    done:   'bg-green-50 border-green-200 text-green-700',
    today:  'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-300',
    soon:   'bg-amber-50 border-amber-300 text-amber-700',
    future: 'bg-slate-50 border-slate-200 text-slate-600',
    unset:  'bg-slate-50 border-dashed border-slate-200 text-slate-400',
  }
  const badge = { done: '済み', today: '今日', soon: `残り${daysLeft}日`, future: `残り${daysLeft}日`, unset: '未設定' }
  const dateDisplay = date ? new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : null
  return (
    <div className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border ${styles[status]} min-w-[80px]`}>
      <span className="text-xs font-semibold">{badge[status]}</span>
      <span className="text-[10px] font-medium opacity-70 leading-tight text-center">{label}</span>
      {dateDisplay && <span className="text-[10px] opacity-60">{dateDisplay}</span>}
    </div>
  )
}

// ─────────────────────────────────────────
// 工程チェックリスト
// ─────────────────────────────────────────

function ChecklistCard({
  tasks,
  onToggle,
}: {
  tasks: TaskRow[]
  onToggle: (taskIndex: number) => void
}) {
  const total = tasks.length
  const done  = tasks.filter((t) => t.is_done).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">工程チェックリスト</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{done}</span>
            <span className="text-slate-400"> / {total}</span>
          </span>
          {/* 達成率バッジ */}
          <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
            pct === 100 ? 'bg-green-100 text-green-700' :
            pct >= 50   ? 'bg-indigo-100 text-indigo-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* 全体進捗バー */}
      <div className="px-6 py-2 bg-slate-50">
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* タスク一覧（フェーズごと） */}
      <div className="divide-y divide-slate-50">
        {PHASE_GROUPS.map((phase) => {
          const phaseTasks = tasks.filter((t) => (phase.indices as readonly number[]).includes(t.task_index))
          const phaseDone  = phaseTasks.filter((t) => t.is_done).length
          const phaseColor = PHASE_COLORS[phase.label as PhaseLabel]

          return (
            <div key={phase.label} className="px-6 py-4">
              {/* フェーズ見出し */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${phaseColor}`}>
                  {phase.label}
                </span>
                <span className="text-xs text-slate-400">
                  {phaseDone} / {phaseTasks.length} 完了
                </span>
              </div>

              {/* タスク行 */}
              <ul className="space-y-1">
                {phaseTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(task.task_index)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg
                        hover:bg-slate-50 transition-colors text-left group"
                    >
                      {/* チェックボックス */}
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        task.is_done
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-slate-300 group-hover:border-indigo-400'
                      }`}>
                        {task.is_done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* タスク番号 */}
                      <span className="text-xs text-slate-400 w-5 flex-shrink-0 text-right font-mono">
                        {task.task_index}
                      </span>

                      {/* タスク名 */}
                      <span className={`text-sm flex-1 transition-colors ${
                        task.is_done
                          ? 'line-through text-slate-400'
                          : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                        {task.label}
                      </span>

                      {/* 完了日時 */}
                      {task.is_done && task.done_at && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {new Date(task.done_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// 削除確認ダイアログ
// ─────────────────────────────────────────

function DeleteDialog({ projectName, onConfirm, onCancel, loading }: {
  projectName: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  const [input, setInput] = useState('')
  const matched = input === projectName
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-xl flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">案件を削除しますか？</h2>
            <p className="text-xs text-slate-500 mt-0.5">一覧には表示されなくなります。</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-3">確認のため、案件名を入力してください：</p>
        <p className="text-sm font-medium text-slate-900 bg-slate-100 rounded-lg px-3 py-2 mb-3 font-mono break-all">
          {projectName}
        </p>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="案件名を入力" className={`${inputCls} mb-5`} autoFocus />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
            キャンセル
          </button>
          <button onClick={onConfirm} disabled={!matched || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
            {loading ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// 変更履歴パネル
// ─────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  company_name: '会社名', project_name: '案件名', production_staff: '制作担当',
  sales_staff: '営業担当', status: 'ステータス', priority: '優先度',
  description: '制作概要', budget: '制作予算', cost: '原価',
  estimated_hours: '予測工数', actual_hours: '実工数', planning_hours: '企画工数',
  shooting_hours: '撮影工数', editing_hours: '編集工数',
  storyboard_date: 'コンテ提出日', schedule_date: '香盤提出日',
  shooting_date: '撮影日', first_draft_date: '初稿提出日',
  final_date: '校了投稿日', notes: '備考', deleted_at: '削除',
}

interface HistoryEntry {
  id: string; change_type: 'create' | 'update' | 'delete'
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

function HistoryPanel({ history }: { history: HistoryEntry[] }) {
  const [open, setOpen] = useState(false)
  if (history.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />変更履歴（{history.length}件）
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-slate-100">
          {history.map((entry) => (
            <div key={entry.id} className="flex gap-3 pt-4">
              <div className="flex-shrink-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  entry.change_type === 'create' ? 'bg-green-400' :
                  entry.change_type === 'delete' ? 'bg-red-400' : 'bg-indigo-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    entry.change_type === 'create' ? 'bg-green-100 text-green-700' :
                    entry.change_type === 'delete' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {entry.change_type === 'create' ? '作成' : entry.change_type === 'delete' ? '削除' : '更新'}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                </div>
                {entry.change_type === 'update' && entry.after_data && (
                  <ul className="space-y-0.5">
                    {Object.keys(entry.after_data).map((key) => (
                      <li key={key} className="text-xs text-slate-600">
                        <span className="font-medium text-slate-700">{FIELD_LABELS[key] ?? key}</span>{' '}
                        <span className="text-slate-400 line-through">{String(entry.before_data?.[key] ?? '（未設定）')}</span>
                        {' → '}
                        <span className="text-slate-700">{String(entry.after_data?.[key] ?? '（未設定）')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// ページコンポーネント
// ─────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [form, setForm] = useState<FormData | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const supabase = createClient()

    const [{ data: proj, error: projErr }, { data: hist }, { data: taskData }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_history')
        .select('id, change_type, before_data, after_data, created_at')
        .eq('project_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('project_tasks')
        .select('*').eq('project_id', id).order('task_index'),
    ])

    if (projErr || !proj) { setError('案件が見つかりません'); setLoading(false); return }

    setProject(proj as Project)
    setForm(projectToForm(proj as Project))
    setHistory((hist ?? []) as HistoryEntry[])

    // タスクが未作成なら既定テンプレートを初期挿入
    if (taskData && taskData.length === 0) {
      const rows = TASK_TEMPLATE.map((label, i) => ({
        project_id: id,
        task_index: i + 1,
        label,
        is_done: false,
      }))
      await supabase.from('project_tasks').insert(rows)
      const { data: fresh } = await supabase.from('project_tasks')
        .select('*').eq('project_id', id).order('task_index')
      setTasks((fresh ?? []) as TaskRow[])
    } else {
      setTasks((taskData ?? []) as TaskRow[])
    }

    setLoading(false)
  }

  // ── チェックトグル（楽観的更新）──
  async function toggleTask(taskIndex: number) {
    const task = tasks.find((t) => t.task_index === taskIndex)
    if (!task) return
    const newDone = !task.is_done
    const now     = newDone ? new Date().toISOString() : null

    // 楽観的に即時反映
    setTasks((prev) =>
      prev.map((t) =>
        t.task_index === taskIndex ? { ...t, is_done: newDone, done_at: now } : t
      )
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('project_tasks')
      .update({ is_done: newDone, done_at: now })
      .eq('project_id', id)
      .eq('task_index', taskIndex)

    // エラー時は元に戻す
    if (error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.task_index === taskIndex ? { ...t, is_done: task.is_done, done_at: task.done_at } : t
        )
      )
    }
  }

  function setField(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !form) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('認証エラー'); setSaving(false); return }
    const payload = formToPayload(form)
    const { beforeData, afterData } = diffProject(project, payload)
    const { error: updateErr } = await supabase.from('projects').update(payload).eq('id', id)
    if (updateErr) { setError(`保存に失敗しました: ${updateErr.message}`); setSaving(false); return }
    if (Object.keys(afterData).length > 0) {
      await supabase.from('project_history').insert({
        project_id: id, changed_by: user.id, change_type: 'update',
        before_data: beforeData, after_data: afterData,
      })
    }
    await load()
    setSaving(false)
    setSavedMessage(true)
    setShowEditForm(false)
    setTimeout(() => setSavedMessage(false), 3000)
  }

  async function handleDelete() {
    if (!project) return
    setDeleting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('認証エラー'); setDeleting(false); return }
    const now = new Date().toISOString()
    const { error: deleteErr } = await supabase.from('projects').update({ deleted_at: now }).eq('id', id)
    if (deleteErr) { setError(`削除に失敗しました: ${deleteErr.message}`); setDeleting(false); setShowDeleteDialog(false); return }
    await supabase.from('project_history').insert({
      project_id: id, changed_by: user.id, change_type: 'delete',
      before_data: { deleted_at: null }, after_data: { deleted_at: now },
    })
    router.push('/projects'); router.refresh()
  }

  // ── ローディング ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (error && !project) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="bg-red-50 text-red-700 rounded-xl border border-red-200 p-6 text-center">
          <p>{error}</p>
          <Link href="/projects" className="mt-4 inline-block text-sm underline">一覧に戻る</Link>
        </div>
      </div>
    )
  }
  if (!project || !form) return null

  // 進捗計算（チェックリスト連動）
  const phases      = calcPhaseProgress(tasks)
  const planState   = phaseState(phases.planning)
  const shootState  = phaseState(phases.shooting)
  const editState   = phaseState(phases.editing)

  // 工数消化率
  const est        = project.estimated_hours ?? 0
  const act        = project.actual_hours   ?? 0
  const hoursRatio = est > 0 ? Math.round((act / est) * 100) : null
  const hoursOver  = hoursRatio != null && hoursRatio > 100

  // 粗利
  const grossProfit  = (project.budget != null && project.cost != null) ? project.budget - project.cost : null
  const grossMargin  = (project.budget != null && grossProfit != null && project.budget > 0)
    ? Math.round((grossProfit / project.budget) * 100) : null

  return (
    <>
      {showDeleteDialog && (
        <DeleteDialog
          projectName={project.project_name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          loading={deleting}
        />
      )}

      <div className="max-w-6xl mx-auto py-8 px-6 pb-12 space-y-6">

        {/* ══ ヘッダー ══ */}
        <div>
          <Link href="/projects"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" />一覧に戻る
          </Link>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-2xl flex-shrink-0">
                  <Film className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-mono mb-0.5">{project.project_no}</p>
                  <h1 className="text-2xl font-bold text-slate-900 leading-tight">{project.project_name}</h1>
                  <p className="text-sm text-slate-500 mt-1">{project.company_name}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${PROJECT_STATUS_COLORS[project.status]}`}>
                      {project.status}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${PROJECT_PRIORITY_COLORS[project.priority]}`}>
                      {project.priority.toUpperCase()}
                    </span>
                    {project.description && (
                      <span className="text-xs text-slate-400 truncate max-w-xs">{project.description}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowEditForm((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg transition-colors">
                  {showEditForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showEditForm ? '閉じる' : '編集'}
                </button>
                <button onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-2 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />削除
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ メインコンテンツ（2カラム） ══ */}
        <div className="grid grid-cols-3 gap-6">

          {/* ── 左カラム（2/3） ── */}
          <div className="col-span-2 space-y-5">

            {/* 工程進捗バー */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>工程進捗</SectionTitle>
              <div className="space-y-5">
                {[
                  { label: '企画', hours: project.planning_hours, pct: phases.planning, state: planState },
                  { label: '撮影', hours: project.shooting_hours, pct: phases.shooting, state: shootState },
                  { label: '編集', hours: project.editing_hours,  pct: phases.editing,  state: editState },
                ].map(({ label, hours, pct, state }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                        {label}
                        {hours != null && <span className="text-xs text-slate-400">{hours}h</span>}
                      </span>
                      <PhaseLabel state={state} pct={pct} />
                    </div>
                    <ProgressBar pct={pct} state={state} />
                  </div>
                ))}
              </div>
            </div>

            {/* ━━━ 工程チェックリスト ━━━ */}
            <ChecklistCard tasks={tasks} onToggle={toggleTask} />

            {/* 工数消化バー */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>工数消化率</SectionTitle>
              {hoursRatio != null ? (
                <>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className={`text-3xl font-bold ${hoursOver ? 'text-red-600' : 'text-slate-900'}`}>{hoursRatio}%</span>
                      {hoursOver && (
                        <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">予算超過</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">{act}h <span className="text-slate-400">/ {est}h</span></span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${hoursOver ? 'bg-red-500' : hoursRatio > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(hoursRatio, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />〜80%：余裕あり</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />80〜100%：注意</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />100%超：超過</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">予測工数・実工数を入力すると表示されます</p>
              )}
            </div>

            {/* スケジュール */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>スケジュール</SectionTitle>
              <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                <MilestoneChip label="コンテ提出" date={project.storyboard_date} />
                <div className="flex items-center text-slate-300 text-xs px-1">→</div>
                <MilestoneChip label="香盤提出" date={project.schedule_date} />
                <div className="flex items-center text-slate-300 text-xs px-1">→</div>
                <MilestoneChip label="撮影日" date={project.shooting_date} />
                <div className="flex items-center text-slate-300 text-xs px-1">→</div>
                <MilestoneChip label="初稿提出" date={project.first_draft_date} />
                <div className="flex items-center text-slate-300 text-xs px-1">→</div>
                <MilestoneChip label="校了投稿" date={project.final_date} />
              </div>
            </div>
          </div>

          {/* ── 右カラム（1/3） ── */}
          <div className="space-y-4">

            {/* 数値サマリー */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionTitle>数値サマリー</SectionTitle>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500"><DollarSign className="w-4 h-4 text-slate-400" />制作予算</div>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(project.budget)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500"><DollarSign className="w-4 h-4 text-slate-400" />原価</div>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(project.cost)}</span>
                </div>
                {grossProfit != null && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <TrendingUp className="w-4 h-4 text-slate-400" />粗利
                      {grossMargin != null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${grossMargin >= 30 ? 'bg-green-100 text-green-700' : grossMargin >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {grossMargin}%
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(grossProfit)}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" />予測工数</span>
                    <span className="text-sm font-semibold text-slate-900">{formatHours(project.estimated_hours)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" />実工数</span>
                    <span className={`text-sm font-semibold ${hoursOver ? 'text-red-600' : 'text-slate-900'}`}>{formatHours(project.actual_hours)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 担当者 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionTitle>担当者</SectionTitle>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">制作担当</p>
                    <p className="text-sm font-medium text-slate-900">{project.production_staff || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">営業担当</p>
                    <p className="text-sm font-medium text-slate-900">{project.sales_staff || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 登録情報 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionTitle>登録情報</SectionTitle>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />作成日</span>
                  <span>{new Date(project.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />更新日</span>
                  <span>{new Date(project.updated_at).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ 折りたたみ編集フォーム ══ */}
        {!showEditForm ? (
          <div className="flex justify-center">
            <button onClick={() => setShowEditForm(true)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-5 py-2.5 rounded-xl transition-colors">
              <ChevronDown className="w-4 h-4" />詳細を編集する
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">編集フォーム</h2>
              <button type="button" onClick={() => setShowEditForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <ChevronUp className="w-3 h-3" />閉じる
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>基本情報</SectionTitle>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="会社名" required><input type="text" required value={form.company_name} onChange={setField('company_name')} className={inputCls} /></Field>
                  <Field label="案件名" required><input type="text" required value={form.project_name} onChange={setField('project_name')} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="制作担当" required><input type="text" required value={form.production_staff} onChange={setField('production_staff')} className={inputCls} /></Field>
                  <Field label="営業担当" required><input type="text" required value={form.sales_staff} onChange={setField('sales_staff')} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="ステータス" required>
                    <select value={form.status} onChange={setField('status')} className={selectCls}>
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="優先度" required>
                    <select value={form.priority} onChange={setField('priority')} className={selectCls}>
                      <option value="must">MUST（必須）</option>
                      <option value="should">SHOULD（重要）</option>
                      <option value="want">WANT（希望）</option>
                    </select>
                  </Field>
                </div>
                <Field label="制作概要">
                  <textarea value={form.description} onChange={setField('description')} rows={3} className={textareaCls} placeholder="制作内容の概要を記入してください" />
                </Field>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>予算・工数</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="制作予算（円）"><input type="number" min="0" value={form.budget} onChange={setField('budget')} className={inputCls} placeholder="500000" /></Field>
                <Field label="原価（円）"><input type="number" min="0" value={form.cost} onChange={setField('cost')} className={inputCls} placeholder="200000" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="予測工数（h）"><input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={setField('estimated_hours')} className={inputCls} placeholder="40" /></Field>
                <Field label="実工数（h）"><input type="number" min="0" step="0.5" value={form.actual_hours} onChange={setField('actual_hours')} className={inputCls} placeholder="0" /></Field>
              </div>
              <p className="text-xs text-slate-400 mt-4 mb-3">内訳工数</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="企画工数（h）"><input type="number" min="0" step="0.5" value={form.planning_hours} onChange={setField('planning_hours')} className={inputCls} placeholder="8" /></Field>
                <Field label="撮影工数（h）"><input type="number" min="0" step="0.5" value={form.shooting_hours} onChange={setField('shooting_hours')} className={inputCls} placeholder="16" /></Field>
                <Field label="編集工数（h）"><input type="number" min="0" step="0.5" value={form.editing_hours} onChange={setField('editing_hours')} className={inputCls} placeholder="16" /></Field>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>スケジュール</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="コンテ提出日"><input type="date" value={form.storyboard_date} onChange={setField('storyboard_date')} className={inputCls} /></Field>
                <Field label="香盤提出日"><input type="date" value={form.schedule_date} onChange={setField('schedule_date')} className={inputCls} /></Field>
                <Field label="撮影日"><input type="date" value={form.shooting_date} onChange={setField('shooting_date')} className={inputCls} /></Field>
                <Field label="初稿提出日"><input type="date" value={form.first_draft_date} onChange={setField('first_draft_date')} className={inputCls} /></Field>
                <Field label="校了投稿日"><input type="date" value={form.final_date} onChange={setField('final_date')} className={inputCls} /></Field>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <SectionTitle>備考</SectionTitle>
              <textarea value={form.notes} onChange={setField('notes')} rows={4} className={textareaCls} placeholder="特記事項・連絡事項など" />
            </div>

            {error && <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>}
            {savedMessage && <div className="rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200">保存しました</div>}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setShowEditForm(false); setForm(projectToForm(project)) }}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                キャンセル
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors">
                <Save className="w-4 h-4" />{saving ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </form>
        )}

        {/* 変更履歴 */}
        <HistoryPanel history={history} />
      </div>
    </>
  )
}
