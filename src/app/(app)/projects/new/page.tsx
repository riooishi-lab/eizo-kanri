'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PROJECT_STATUSES, type ProjectStatus, type ProjectPriority } from '@/types/project'
import { ChevronLeft, Save } from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────
// 共通フォームパーツ
// ─────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 pb-2
      border-b border-slate-100">
      {children}
    </h2>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ' +
  'placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400'

const selectCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

const textareaCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ' +
  'placeholder:text-slate-400 resize-none'

// ─────────────────────────────────────────
// フォーム型
// ─────────────────────────────────────────

interface FormData {
  company_name: string
  project_name: string
  production_staff: string
  sales_staff: string
  status: ProjectStatus
  priority: ProjectPriority
  description: string
  budget: string
  cost: string
  estimated_hours: string
  actual_hours: string
  planning_hours: string
  shooting_hours: string
  editing_hours: string
  storyboard_date: string
  schedule_date: string
  shooting_date: string
  first_draft_date: string
  final_date: string
  notes: string
}

const initialForm: FormData = {
  company_name: '',
  project_name: '',
  production_staff: '',
  sales_staff: '',
  status: '未着手',
  priority: 'should',
  description: '',
  budget: '',
  cost: '',
  estimated_hours: '',
  actual_hours: '',
  planning_hours: '',
  shooting_hours: '',
  editing_hours: '',
  storyboard_date: '',
  schedule_date: '',
  shooting_date: '',
  first_draft_date: '',
  final_date: '',
  notes: '',
}

function toNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function toDate(val: string): string | null {
  return val === '' ? null : val
}

// ─────────────────────────────────────────
// ページコンポーネント
// ─────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // DBのトリガー・関数に依存せず JS 側で採番
    const { getNextProjectNos } = await import('@/lib/project-no')
    const [projectNo] = await getNextProjectNos(supabase)

    const { error: insertError } = await supabase.from('projects').insert({
      project_no: projectNo,
      company_name: form.company_name.trim(),
      project_name: form.project_name.trim(),
      production_staff: form.production_staff.trim() || null,
      sales_staff: form.sales_staff.trim() || null,
      status: form.status,
      priority: form.priority,
      description: form.description.trim() || null,
      budget: toNum(form.budget),
      cost: toNum(form.cost),
      estimated_hours: toNum(form.estimated_hours),
      actual_hours: toNum(form.actual_hours),
      planning_hours: toNum(form.planning_hours),
      shooting_hours: toNum(form.shooting_hours),
      editing_hours: toNum(form.editing_hours),
      storyboard_date: toDate(form.storyboard_date),
      schedule_date: toDate(form.schedule_date),
      shooting_date: toDate(form.shooting_date),
      first_draft_date: toDate(form.first_draft_date),
      final_date: toDate(form.final_date),
      notes: form.notes.trim() || null,
    })

    if (insertError) {
      setError(`保存に失敗しました: ${insertError.message}`)
      setLoading(false)
      return
    }

    router.push('/projects')
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900
            hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          一覧に戻る
        </Link>
        <h1 className="text-xl font-bold text-slate-900">新規案件登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── 基本情報 ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SectionTitle>基本情報</SectionTitle>
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="会社名" required>
                <input
                  type="text"
                  required
                  value={form.company_name}
                  onChange={set('company_name')}
                  className={inputCls}
                  placeholder="株式会社○○"
                />
              </Field>
              <Field label="案件名" required>
                <input
                  type="text"
                  required
                  value={form.project_name}
                  onChange={set('project_name')}
                  className={inputCls}
                  placeholder="商品紹介動画制作"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="制作担当" required>
                <input
                  type="text"
                  required
                  value={form.production_staff}
                  onChange={set('production_staff')}
                  className={inputCls}
                  placeholder="山田 太郎"
                />
              </Field>
              <Field label="営業担当" required>
                <input
                  type="text"
                  required
                  value={form.sales_staff}
                  onChange={set('sales_staff')}
                  className={inputCls}
                  placeholder="佐藤 花子"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="ステータス" required>
                <select
                  value={form.status}
                  onChange={set('status')}
                  className={selectCls}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="優先度" required>
                <select
                  value={form.priority}
                  onChange={set('priority')}
                  className={selectCls}
                >
                  <option value="must">MUST（必須）</option>
                  <option value="should">SHOULD（重要）</option>
                  <option value="want">WANT（希望）</option>
                </select>
              </Field>
            </div>

            <Field label="制作概要">
              <textarea
                value={form.description}
                onChange={set('description')}
                rows={3}
                className={textareaCls}
                placeholder="制作内容の概要を記入してください"
              />
            </Field>
          </div>
        </div>

        {/* ── 予算・工数 ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SectionTitle>予算・工数</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field label="制作予算（円）">
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={set('budget')}
                className={inputCls}
                placeholder="500000"
              />
            </Field>
            <Field label="原価（円）">
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={set('cost')}
                className={inputCls}
                placeholder="200000"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="予測工数（h）">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.estimated_hours}
                onChange={set('estimated_hours')}
                className={inputCls}
                placeholder="40"
              />
            </Field>
            <Field label="実工数（h）">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.actual_hours}
                onChange={set('actual_hours')}
                className={inputCls}
                placeholder="0"
              />
            </Field>
          </div>

          <p className="text-xs text-slate-400 mt-4 mb-3">内訳工数</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="企画工数（h）">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.planning_hours}
                onChange={set('planning_hours')}
                className={inputCls}
                placeholder="8"
              />
            </Field>
            <Field label="撮影工数（h）">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.shooting_hours}
                onChange={set('shooting_hours')}
                className={inputCls}
                placeholder="16"
              />
            </Field>
            <Field label="編集工数（h）">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.editing_hours}
                onChange={set('editing_hours')}
                className={inputCls}
                placeholder="16"
              />
            </Field>
          </div>
        </div>

        {/* ── スケジュール ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SectionTitle>スケジュール</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field label="コンテ提出日">
              <input
                type="date"
                value={form.storyboard_date}
                onChange={set('storyboard_date')}
                className={inputCls}
              />
            </Field>
            <Field label="香盤提出日">
              <input
                type="date"
                value={form.schedule_date}
                onChange={set('schedule_date')}
                className={inputCls}
              />
            </Field>
            <Field label="撮影日">
              <input
                type="date"
                value={form.shooting_date}
                onChange={set('shooting_date')}
                className={inputCls}
              />
            </Field>
            <Field label="初稿提出日">
              <input
                type="date"
                value={form.first_draft_date}
                onChange={set('first_draft_date')}
                className={inputCls}
              />
            </Field>
            <Field label="校了投稿日">
              <input
                type="date"
                value={form.final_date}
                onChange={set('final_date')}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* ── 備考 ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SectionTitle>備考</SectionTitle>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={4}
            className={textareaCls}
            placeholder="特記事項・連絡事項など"
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href="/projects">
            <button
              type="button"
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white
                border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
              bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
              rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : '案件を登録する'}
          </button>
        </div>
      </form>
    </div>
  )
}
