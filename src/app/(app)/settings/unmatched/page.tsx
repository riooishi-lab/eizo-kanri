'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, AlertCircle, Link2, EyeOff, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type UnmatchedLog = {
  id: string
  date: string
  company_name: string | null
  project_name: string | null
  work_type: string | null
  hours: number | null
  google_event_title: string | null
}

type Project = {
  id: string
  project_name: string
  company_name: string
}

export default function UnmatchedPage() {
  const [logs, setLogs]           = useState<UnmatchedLog[]>([])
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [linking, setLinking]     = useState<string | null>(null)   // ログID
  const [selected, setSelected]   = useState<Record<string, string>>({}) // logId → projectId
  const [toast, setToast]         = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: logData }, { data: projData }] = await Promise.all([
        supabase
          .from('work_logs')
          .select('id, date, company_name, project_name, work_type, hours, google_event_title')
          .eq('user_id', user.id)
          .is('project_id', null)
          .or('ignored.is.null,ignored.eq.false')
          .order('date', { ascending: false }),
        supabase
          .from('projects')
          .select('id, project_name, company_name')
          .is('deleted_at', null)
          .order('company_name'),
      ])

      setLogs(logData ?? [])
      setProjects(projData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleLink(logId: string) {
    const projectId = selected[logId]
    if (!projectId) return
    setLinking(logId)
    const supabase = createClient()
    const { error } = await supabase
      .from('work_logs')
      .update({ project_id: projectId })
      .eq('id', logId)
    setLinking(null)
    if (error) {
      showToast('紐付けに失敗しました')
    } else {
      setLogs(prev => prev.filter(l => l.id !== logId))
      showToast('案件に紐付けました')
    }
  }

  async function handleIgnore(logId: string) {
    setLinking(logId)
    const supabase = createClient()
    const { error } = await supabase
      .from('work_logs')
      .update({ ignored: true })
      .eq('id', logId)
    setLinking(logId)
    setLinking(null)
    if (error) {
      showToast('操作に失敗しました')
    } else {
      setLogs(prev => prev.filter(l => l.id !== logId))
      showToast('無視リストに追加しました')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5
          bg-slate-800 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          {toast}
        </div>
      )}

      <Link
        href="/settings/google"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Googleカレンダー設定に戻る
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">未マッチのカレンダーログ</h1>
          <p className="text-sm text-slate-500">案件に紐付けられていない作業ログを手動でマッチングできます</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">読み込み中...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">未マッチのログはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{logs.length} 件のログが未マッチです</p>
          {logs.map(log => (
            <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* ログ情報 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">{log.date}</p>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {log.google_event_title ?? '(タイトルなし)'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {log.company_name && (
                      <span className="text-xs text-slate-500">{log.company_name}</span>
                    )}
                    {log.project_name && (
                      <span className="text-xs text-slate-500">/ {log.project_name}</span>
                    )}
                    {log.work_type && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {log.work_type}
                      </span>
                    )}
                    {log.hours != null && (
                      <span className="text-xs text-slate-400">{log.hours}h</span>
                    )}
                  </div>
                </div>

                {/* 操作エリア */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selected[log.id] ?? ''}
                    onChange={e => setSelected(prev => ({ ...prev, [log.id]: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700
                      bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[160px]"
                  >
                    <option value="">案件を選択...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company_name} / {p.project_name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleLink(log.id)}
                    disabled={!selected[log.id] || linking === log.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700
                      disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    紐付け
                  </button>

                  <button
                    onClick={() => handleIgnore(log.id)}
                    disabled={linking === log.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200
                      hover:bg-slate-50 disabled:opacity-40 text-slate-500 rounded-lg text-xs
                      font-medium transition-colors"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    無視
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
