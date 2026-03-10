'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, CheckCircle2, RefreshCw, AlertCircle, ExternalLink, ArrowLeft, List } from 'lucide-react'
import Link from 'next/link'

type TokenInfo = {
  google_email: string | null
  last_synced_at: string | null
  expires_at: string
}

type SyncResult = {
  synced: number
  skipped: number
} | null

export default function GoogleSettingsPage() {
  const [tokenInfo, setTokenInfo]     = useState<TokenInfo | null>(null)
  const [loading, setLoading]         = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncResult, setSyncResult]   = useState<SyncResult>(null)
  const [syncError, setSyncError]     = useState<string | null>(null)

  // URL パラメータからの通知
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'connected') {
      setSuccessMsg('Googleアカウントの連携が完了しました')
      window.history.replaceState({}, '', '/settings/google')
    }
    const err = params.get('error')
    if (err) {
      setErrorMsg(`連携に失敗しました（${err}）`)
      window.history.replaceState({}, '', '/settings/google')
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('google_tokens')
        .select('google_email, last_synced_at, expires_at')
        .eq('user_id', user.id)
        .single()

      setTokenInfo(data ?? null)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)

    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        setSyncError(json.error ?? '同期に失敗しました')
      } else {
        setSyncResult({ synced: json.synced, skipped: json.skipped })
        // last_synced_at を更新
        setTokenInfo(prev => prev
          ? { ...prev, last_synced_at: new Date().toISOString() }
          : prev
        )
      }
    } catch {
      setSyncError('ネットワークエラーが発生しました')
    } finally {
      setSyncing(false)
    }
  }

  const isConnected = tokenInfo !== null
  const isTokenExpired = isConnected && new Date(tokenInfo.expires_at) < new Date()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        案件一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-xl">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Googleカレンダー連携</h1>
          <p className="text-sm text-slate-500">カレンダーのイベントを作業ログに自動取り込みします</p>
        </div>
      </div>

      {/* 成功・エラー通知 */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* 連携状態カード */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">連携状態</h2>

        {loading ? (
          <div className="text-sm text-slate-400">読み込み中...</div>
        ) : isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-slate-800">連携済み</span>
              {isTokenExpired && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  トークン期限切れ
                </span>
              )}
            </div>

            {tokenInfo.google_email && (
              <div className="text-sm text-slate-600">
                <span className="text-slate-400">Googleアカウント：</span>
                {tokenInfo.google_email}
              </div>
            )}

            {tokenInfo.last_synced_at && (
              <div className="text-sm text-slate-600">
                <span className="text-slate-400">最終同期：</span>
                {new Date(tokenInfo.last_synced_at).toLocaleString('ja-JP')}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertCircle className="w-4 h-4" />
            未連携
          </div>
        )}

        {/* 連携 / 再連携ボタン */}
        <a
          href="/api/auth/google"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300
            rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {isConnected ? 'Googleアカウントを再連携する' : 'Googleアカウントを連携する'}
        </a>
      </div>

      {/* 同期カード */}
      {isConnected && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">カレンダー同期</h2>
          <p className="text-xs text-slate-500 mb-4">
            過去90日〜未来30日のイベントを取り込みます。
            タイトルが{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded">【企業名】案件名/作業名</code>
            {' '}形式のイベントが対象です。
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
              disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同期中...' : '今すぐ同期'}
          </button>

          {/* 同期結果 */}
          {syncResult && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {syncResult.synced} 件を取り込みました
              {syncResult.skipped > 0 && (
                <span className="text-green-600">（{syncResult.skipped} 件は案件未照合でスキップ）</span>
              )}
            </div>
          )}

          {syncError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {syncError === 'token_expired_no_refresh'
                ? 'トークンが期限切れです。再連携してください。'
                : syncError === 'google_not_connected'
                ? 'Googleアカウントが連携されていません。'
                : `同期に失敗しました：${syncError}`}
            </div>
          )}

          {/* 未マッチ一覧へのリンク */}
          {syncResult && syncResult.skipped > 0 && (
            <Link
              href="/settings/unmatched"
              className="mt-3 inline-flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800
                hover:underline"
            >
              <List className="w-3.5 h-3.5" />
              未マッチのログを確認・手動紐付けする
            </Link>
          )}

          {/* 常時表示の未マッチリンク */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
              href="/settings/unmatched"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800
                hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <List className="w-4 h-4" />
              未マッチのログ一覧
            </Link>
          </div>

          {/* 作業種別の説明 */}
          <details className="mt-4 space-y-3">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
              タイトル形式と作業種別の一覧
            </summary>

            {/* タイトル形式例 */}
            <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-1">
              <p className="text-xs font-medium text-slate-600 mb-1">カレンダーのタイトル例：</p>
              {[
                '【愛媛銀行】キャリアファイル/修正対応',
                '【茨城トヨペット】採用動画/撮影',
                '【MUSVI】PV制作/編集',
              ].map(ex => (
                <p key={ex} className="text-xs text-slate-500 font-mono">{ex}</p>
              ))}
            </div>

            {/* 作業種別マッピング */}
            <table className="text-xs text-slate-600 border-collapse w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1 pr-4 font-medium text-slate-500">作業名（/以降）</th>
                  <th className="text-left py-1 font-medium text-slate-500">→ 分類</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  ['編集 / edit / カット編集 / 編集作業', '編集'],
                  ['撮影 / shoot / 撮影作業', '撮影'],
                  ['企画 / plan / 企画作業 / 構成', '企画'],
                  ['段取り / prep / 段取り作業', '段取り'],
                  ['打合せ / 打ち合わせ / meeting / MTG', '打合せ'],
                  ['その他すべて', 'その他'],
                ].map(([input, output]) => (
                  <tr key={output}>
                    <td className="py-1 pr-4 text-slate-500">{input}</td>
                    <td className="py-1 font-medium">{output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  )
}
