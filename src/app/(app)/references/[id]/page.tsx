'use client'

export const dynamic = 'force-dynamic'

import { use, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reference, ReferenceFolder, ReferenceTimestamp, ReferenceOrientation } from '@/types/reference'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Pin, Pencil, Trash2, ExternalLink,
  Plus, X, Clock, Loader2, Monitor, Smartphone,
  ChevronDown, ChevronUp, Play,
} from 'lucide-react'

// ── YouTube IFrame API 型定義 ─────────────────────────────────────────────
interface YTPlayerInstance {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  destroy(): void
}
declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId?: string
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void
          }
        }
      ) => YTPlayerInstance
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

// ── 都道府県リスト ─────────────────────────────────────────────────────────
const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

// ── ユーティリティ ─────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseTime(str: string): number | null {
  const m = str.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

// ── 関連動画カード ─────────────────────────────────────────────────────────
function RelatedCard({ item }: { item: Reference }) {
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  return (
    <div
      onClick={() => router.push(`/references/${item.id}`)}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer
        hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="aspect-video bg-slate-100 overflow-hidden">
        {item.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ExternalLink className="w-5 h-5 text-slate-300" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-slate-700 line-clamp-2 leading-snug mb-1.5">
          {item.title ?? item.url}
        </p>
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map(t => (
            <span
              key={t}
              className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function ReferenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router  = useRouter()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [ref, setRef]               = useState<Reference | null>(null)
  const [folders, setFolders]       = useState<ReferenceFolder[]>([])
  const [timestamps, setTimestamps] = useState<ReferenceTimestamp[]>([])
  const [relatedRefs, setRelatedRefs] = useState<Reference[]>([])
  const [loading, setLoading]       = useState(true)

  // ── YouTube ───────────────────────────────────────────────────────────────
  const [youtubeId, setYoutubeId]   = useState<string | null>(null)
  const playerRef                   = useRef<YTPlayerInstance | null>(null)
  const [ytReady, setYtReady]       = useState(false)

  // ── Timestamp form ────────────────────────────────────────────────────────
  const [tsTime, setTsTime]         = useState('')
  const [tsMemo, setTsMemo]         = useState('')
  const [tsSaving, setTsSaving]     = useState(false)
  const [tsExpanded, setTsExpanded] = useState(true)

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const [sidebarMode, setSidebarMode]       = useState<'view' | 'edit'>('view')
  const [draftTitle, setDraftTitle]         = useState('')
  const [draftCompany, setDraftCompany]     = useState('')
  const [draftPrefecture, setDraftPrefecture] = useState('')
  const [draftCaseContent, setDraftCaseContent] = useState('')
  const [draftTags, setDraftTags]           = useState('')
  const [draftOrientation, setDraftOrientation] = useState<ReferenceOrientation>('landscape')
  const [draftFolderId, setDraftFolderId]   = useState('')
  const [sidebarSaving, setSidebarSaving]   = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: refData }, { data: tsData }, { data: folderData }] = await Promise.all([
        supabase.from('video_references').select('*').eq('id', id).single(),
        supabase.from('reference_timestamps').select('*').eq('reference_id', id).order('time_seconds'),
        supabase.from('reference_folders').select('*').order('created_at'),
      ])

      if (refData) {
        const r = refData as Reference
        setRef(r)
        const ytId = getYouTubeId(r.url)
        setYoutubeId(ytId)
      }

      setTimestamps((tsData ?? []) as ReferenceTimestamp[])
      setFolders((folderData ?? []) as ReferenceFolder[])
      setLoading(false)
    }
    load()
  }, [id])

  // ── Load related refs ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ref || ref.tags.length === 0) return
    async function loadRelated() {
      const supabase = createClient()
      const { data } = await supabase
        .from('video_references')
        .select('*')
        .overlaps('tags', ref!.tags)
        .neq('id', id)
        .limit(6)
      setRelatedRefs((data ?? []) as Reference[])
    }
    loadRelated()
  }, [ref, id])

  // ── YouTube IFrame API ────────────────────────────────────────────────────
  useEffect(() => {
    if (!youtubeId) return
    let active = true

    function createPlayer() {
      if (!active || !window.YT) return
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: youtubeId!,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (active) setYtReady(true)
          },
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      window.onYouTubeIframeAPIReady = createPlayer
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script')
        tag.id = 'yt-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    return () => {
      active = false
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
      setYtReady(false)
    }
  }, [youtubeId])

  // ── Sidebar edit ──────────────────────────────────────────────────────────
  function openEditMode() {
    if (!ref) return
    setDraftTitle(ref.title ?? '')
    setDraftCompany(ref.company_name ?? '')
    setDraftPrefecture(ref.prefecture ?? '')
    setDraftCaseContent(ref.case_content ?? '')
    setDraftTags((ref.tags ?? []).join(' '))
    setDraftOrientation(ref.orientation)
    setDraftFolderId(ref.folder_id ?? '')
    setSidebarMode('edit')
  }

  async function saveSidebar() {
    if (!ref) return
    setSidebarSaving(true)
    const tags = draftTags.split(/[\s,　、]+/).map(t => t.trim()).filter(Boolean)
    const supabase = createClient()
    await supabase.from('video_references').update({
      title:        draftTitle || null,
      company_name: draftCompany || null,
      prefecture:   draftPrefecture || null,
      case_content: draftCaseContent || null,
      tags,
      orientation:  draftOrientation,
      folder_id:    draftFolderId || null,
    }).eq('id', id)
    setRef(prev => prev ? {
      ...prev,
      title:        draftTitle || null,
      company_name: draftCompany || null,
      prefecture:   draftPrefecture || null,
      case_content: draftCaseContent || null,
      tags,
      orientation:  draftOrientation,
      folder_id:    draftFolderId || null,
    } : prev)
    setSidebarSaving(false)
    setSidebarMode('view')
  }

  // ── Pin ────────────────────────────────────────────────────────────────────
  async function togglePin() {
    if (!ref) return
    const next = !ref.is_pinned
    setRef(prev => prev ? { ...prev, is_pinned: next } : prev)
    const supabase = createClient()
    await supabase.from('video_references').update({ is_pinned: next }).eq('id', id)
  }

  // ── Capture current time ──────────────────────────────────────────────────
  function captureCurrentTime() {
    if (!playerRef.current) return
    const secs = Math.floor(playerRef.current.getCurrentTime())
    setTsTime(formatTime(secs))
  }

  // ── Timestamp add/delete ──────────────────────────────────────────────────
  async function addTimestamp() {
    const seconds = parseTime(tsTime)
    if (seconds === null) return
    setTsSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reference_timestamps')
      .insert({ reference_id: id, time_seconds: seconds, memo: tsMemo || null })
      .select().single()
    setTsSaving(false)
    if (!error && data) {
      setTimestamps(prev =>
        [...prev, data as ReferenceTimestamp].sort((a, b) => a.time_seconds - b.time_seconds)
      )
      setTsTime('')
      setTsMemo('')
    }
  }

  async function deleteTimestamp(tsId: string) {
    const supabase = createClient()
    await supabase.from('reference_timestamps').delete().eq('id', tsId)
    setTimestamps(prev => prev.filter(t => t.id !== tsId))
  }

  function jumpToTimestamp(seconds: number) {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm('このリファレンスを削除しますか？')) return
    const supabase = createClient()
    await supabase.from('video_references').delete().eq('id', id)
    router.push('/references')
  }

  // ────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    )
  }
  if (!ref) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>リファレンスが見つかりません</p>
      </div>
    )
  }

  const folder = folders.find(f => f.id === ref.folder_id)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 左メインエリア ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-2">
          <Link
            href="/references"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            リファレンス一覧
          </Link>
        </div>

        <div className="px-6 pb-10 space-y-6">
          {/* ── メディア ── */}
          <div>
            {youtubeId ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-md">
                <div id="yt-player" className="w-full h-full" />
              </div>
            ) : ref.thumbnail_url ? (
              <a href={ref.url} target="_blank" rel="noopener noreferrer">
                <div className={`w-full rounded-xl overflow-hidden bg-slate-100 shadow-md
                  hover:opacity-90 transition-opacity
                  ${ref.orientation === 'portrait' ? 'max-w-xs mx-auto' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.thumbnail_url} alt={ref.title ?? ''} className="w-full object-cover" />
                </div>
              </a>
            ) : (
              <div className="aspect-video w-full rounded-xl bg-slate-100 flex items-center justify-center shadow-md">
                <ExternalLink className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </div>

          {/* ── タイトル & 登録日 ── */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-1">
              {ref.title ?? ref.url}
            </h1>
            <p className="text-sm text-slate-400">
              登録日: {new Date(ref.created_at).toLocaleDateString('ja-JP')}
            </p>
          </div>

          {/* ── タイムスタンプ（アコーディオン）── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* ヘッダー */}
            <button
              onClick={() => setTsExpanded(prev => !prev)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50
                hover:bg-slate-100 transition-colors"
            >
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-700 flex-1 text-left">
                タイムスタンプ
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  ({timestamps.length}件)
                </span>
              </span>
              {tsExpanded
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {/* コンテンツ */}
            {tsExpanded && (
              <div className="px-4 py-4 space-y-3">
                {/* 追加フォーム */}
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="MM:SS"
                    value={tsTime}
                    onChange={e => setTsTime(e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center"
                  />
                  {youtubeId && (
                    <button
                      onClick={captureCurrentTime}
                      disabled={!ytReady}
                      title="今の再生位置を記録"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100
                        hover:bg-slate-200 disabled:opacity-40 text-slate-600 rounded-lg
                        text-xs font-medium transition-colors shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      今の時間
                    </button>
                  )}
                  <input
                    type="text"
                    placeholder="メモを入力..."
                    value={tsMemo}
                    onChange={e => setTsMemo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTimestamp() }}
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-300 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addTimestamp}
                    disabled={!tsTime || tsSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600
                      hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg
                      text-sm font-medium transition-colors shrink-0"
                  >
                    {tsSaving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Plus className="w-4 h-4" />}
                    追加
                  </button>
                </div>

                {/* 一覧 */}
                {timestamps.length === 0 ? (
                  <p className="text-xs text-slate-400">タイムスタンプはまだありません</p>
                ) : (
                  <div className="space-y-1">
                    {timestamps.map(ts => (
                      <div
                        key={ts.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 group"
                      >
                        <button
                          onClick={() => jumpToTimestamp(ts.time_seconds)}
                          className={`font-mono text-sm font-semibold shrink-0 transition-colors
                            ${youtubeId
                              ? 'text-blue-500 hover:text-blue-700 cursor-pointer'
                              : 'text-slate-500 cursor-default'}`}
                        >
                          {formatTime(ts.time_seconds)}
                        </button>
                        <span className="flex-1 text-sm text-slate-700">{ts.memo}</span>
                        <button
                          onClick={() => deleteTimestamp(ts.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300
                            hover:text-red-500 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 関連動画 ── */}
          {relatedRefs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">関連動画</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {relatedRefs.map(r => (
                  <RelatedCard key={r.id} item={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 右サイドバー ── */}
      <div className="w-72 shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* アクションバー */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePin}
              title={ref.is_pinned ? 'ピン留め解除' : 'ピン留め'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                border transition-colors
                ${ref.is_pinned
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'}`}
            >
              <Pin className="w-4 h-4" />
              {ref.is_pinned ? 'ピン中' : 'ピン'}
            </button>

            <div className="ml-auto flex items-center gap-1">
              {sidebarMode === 'view' && (
                <button
                  onClick={openEditMode}
                  title="編集"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600
                    hover:bg-indigo-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDelete}
                title="削除"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500
                  hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <hr className="border-slate-200" />

          {sidebarMode === 'view' ? (
            /* ════ 表示モード ════ */
            <div className="space-y-4">
              {/* URL */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">動画URL</p>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 text-xs text-blue-600 hover:underline break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {ref.url}
                </a>
              </div>

              {/* タイトル */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">タイトル</p>
                <p className="text-sm text-slate-700">{ref.title ?? '-'}</p>
              </div>

              {/* 企業名 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">企業名</p>
                <p className="text-sm text-slate-700">{ref.company_name ?? '-'}</p>
              </div>

              {/* 都道府県 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">都道府県</p>
                <p className="text-sm text-slate-700">{ref.prefecture ?? '-'}</p>
              </div>

              {/* 案件内容 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">案件内容</p>
                {ref.case_content ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{ref.case_content}</p>
                ) : (
                  <p className="text-sm text-slate-400">-</p>
                )}
              </div>

              {/* タグ */}
              {ref.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">タグ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ref.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100
                          px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 向き */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">向き</p>
                <div className="flex items-center gap-1.5 text-sm text-slate-700">
                  {ref.orientation === 'landscape'
                    ? <><Monitor className="w-3.5 h-3.5" /> 横型</>
                    : <><Smartphone className="w-3.5 h-3.5" /> 縦型</>}
                </div>
              </div>

              {/* フォルダ */}
              {folder && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">フォルダ</p>
                  <div className="flex items-center gap-1.5 text-sm text-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: folder.color }}
                    />
                    {folder.name}
                  </div>
                </div>
              )}

              {/* 登録日 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">登録日</p>
                <p className="text-sm text-slate-700">
                  {new Date(ref.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
          ) : (
            /* ════ 編集モード ════ */
            <div className="space-y-3">
              {/* タイトル */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">タイトル</label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>

              {/* 企業名 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">企業名</label>
                <input
                  type="text"
                  value={draftCompany}
                  onChange={e => setDraftCompany(e.target.value)}
                  placeholder="例: 株式会社○○"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>

              {/* 都道府県 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">都道府県</label>
                <select
                  value={draftPrefecture}
                  onChange={e => setDraftPrefecture(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">選択してください</option>
                  {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 案件内容 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">案件内容</label>
                <textarea
                  value={draftCaseContent}
                  onChange={e => setDraftCaseContent(e.target.value)}
                  placeholder="制作内容のメモ..."
                  rows={4}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
                />
              </div>

              {/* タグ */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  タグ <span className="text-slate-400">（スペース区切り）</span>
                </label>
                <input
                  type="text"
                  value={draftTags}
                  onChange={e => setDraftTags(e.target.value)}
                  placeholder="採用 PR インタビュー"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>

              {/* 向き */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">向き</label>
                <div className="flex gap-2">
                  {(['landscape', 'portrait'] as const).map(o => (
                    <button
                      key={o}
                      onClick={() => setDraftOrientation(o)}
                      className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-lg
                        text-xs font-medium border transition-colors
                        ${draftOrientation === o
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'}`}
                    >
                      {o === 'landscape'
                        ? <><Monitor className="w-3.5 h-3.5" /> 横型</>
                        : <><Smartphone className="w-3.5 h-3.5" /> 縦型</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* フォルダ */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">フォルダ</label>
                <select
                  value={draftFolderId}
                  onChange={e => setDraftFolderId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">なし</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSidebarMode('view')}
                  className="flex-1 px-3 py-2 text-sm text-slate-600 border border-slate-200
                    rounded-lg hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveSidebar}
                  disabled={sidebarSaving}
                  className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2
                    bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                    text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {sidebarSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
