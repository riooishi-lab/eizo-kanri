'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reference, ReferenceFolder, ReferenceOrientation } from '@/types/reference'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Folder, FolderPlus, Trash2, ExternalLink,
  Loader2, X, Monitor, Smartphone, Pin,
} from 'lucide-react'

// ── プリセットカラー ───────────────────────────────────────────────────────
const PRESET_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#3B82F6']

// ── サムネイルコンポーネント ──────────────────────────────────────────────
function Thumbnail({
  src, alt, orientation,
}: { src: string | null; alt: string | null; orientation: ReferenceOrientation }) {
  const [error, setError] = useState(false)
  const aspect = orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'

  return (
    <div className={`${aspect} bg-slate-100 overflow-hidden`}>
      {src && !error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ''}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-slate-300" />
        </div>
      )}
    </div>
  )
}

// ── リファレンスカード ────────────────────────────────────────────────────
function ReferenceCard({
  item,
  folders,
  onDelete,
  onMoveFolder,
}: {
  item: Reference
  folders: ReferenceFolder[]
  onDelete: (id: string) => void
  onMoveFolder: (id: string, folderId: string | null) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('このリファレンスを削除しますか？')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('video_references').delete().eq('id', item.id)
    onDelete(item.id)
  }

  return (
    <div
      onClick={() => router.push(`/references/${item.id}`)}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer
        hover:shadow-md hover:border-indigo-200 transition-all group"
    >
      {/* サムネイル（クリックで詳細ページへ） */}
      <Thumbnail src={item.thumbnail_url} alt={item.title} orientation={item.orientation} />

      {/* 情報エリア */}
      <div className="p-3">
        <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600
          line-clamp-2 leading-snug mb-2 transition-colors">
          {item.title ?? item.url}
        </p>

        {/* ピンバッジ */}
        {item.is_pinned && (
          <div className="flex items-center gap-1 text-xs text-amber-500 mb-1.5">
            <Pin className="w-3 h-3" />
            <span>ピン留め中</span>
          </div>
        )}

        {/* タグ */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.tags.map(tag => (
              <span
                key={tag}
                className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100
                  px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* フォルダ移動 & 削除（stopPropagation で詳細遷移を防止） */}
        <div
          className="flex items-center gap-1.5 mt-1"
          onClick={e => e.stopPropagation()}
        >
          <select
            value={item.folder_id ?? ''}
            onClick={e => e.stopPropagation()}
            onChange={async e => {
              e.stopPropagation()
              const val = e.target.value || null
              const supabase = createClient()
              await supabase.from('video_references').update({ folder_id: val }).eq('id', item.id)
              onMoveFolder(item.id, val)
            }}
            className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-1
              text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">フォルダなし</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded
              transition-colors disabled:opacity-50"
            title="削除"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function ReferencesPage() {
  const [refs, setRefs]         = useState<Reference[]>([])
  const [folders, setFolders]   = useState<ReferenceFolder[]>([])
  const [loading, setLoading]   = useState(true)

  // フィルター
  const [selectedFolder, setSelectedFolder]       = useState<string | null>(null)
  const [searchQuery, setSearchQuery]             = useState('')
  const [activeTag, setActiveTag]                 = useState<string | null>(null)
  const [viewOrientation, setViewOrientation]     = useState<'all' | ReferenceOrientation>('all')

  // 登録モーダル
  const [showAddModal, setShowAddModal]   = useState(false)
  const [addUrl, setAddUrl]               = useState('')
  const [fetchLoading, setFetchLoading]   = useState(false)
  const [fetchError, setFetchError]       = useState<string | null>(null)
  const [addForm, setAddForm]             = useState<{
    title: string
    description: string
    thumbnail_url: string
    orientation: ReferenceOrientation
    folder_id: string
    tags: string
    company_name: string
    case_content: string
  }>({ title: '', description: '', thumbnail_url: '', orientation: 'landscape', folder_id: '', tags: '', company_name: '', case_content: '' })
  const [saving, setSaving]               = useState(false)

  // フォルダ作成モーダル
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName]     = useState('')
  const [newFolderColor, setNewFolderColor]   = useState('#6366F1')
  const [folderSaving, setFolderSaving]       = useState(false)

  // ── データ取得 ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: refData }, { data: folderData }] = await Promise.all([
        supabase.from('video_references').select('*').order('created_at', { ascending: false }),
        supabase.from('reference_folders').select('*').order('created_at'),
      ])
      setRefs((refData ?? []) as Reference[])
      setFolders((folderData ?? []) as ReferenceFolder[])
      setLoading(false)
    }
    load()
  }, [])

  // ── タグ一覧 ────────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of refs) r.tags.forEach(t => { counts[t] = (counts[t] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [refs])

  // ── フォルダ件数 ────────────────────────────────────────────────────────
  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of refs) {
      if (r.folder_id) map[r.folder_id] = (map[r.folder_id] ?? 0) + 1
    }
    return map
  }, [refs])

  // ── フィルタリング ──────────────────────────────────────────────────────
  const filteredRefs = useMemo(() => {
    return refs
      .filter(r => selectedFolder ? r.folder_id === selectedFolder : true)
      .filter(r => viewOrientation !== 'all' ? r.orientation === viewOrientation : true)
      .filter(r => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (r.title ?? '').toLowerCase().includes(q)
            || r.tags.join(' ').toLowerCase().includes(q)
            || (r.description ?? '').toLowerCase().includes(q)
      })
      .filter(r => activeTag ? r.tags.includes(activeTag) : true)
  }, [refs, selectedFolder, viewOrientation, searchQuery, activeTag])

  // ── ピン済み / 通常 ──────────────────────────────────────────────────────
  const pinnedRefs  = useMemo(() => filteredRefs.filter(r => r.is_pinned),  [filteredRefs])
  const regularRefs = useMemo(() => filteredRefs.filter(r => !r.is_pinned), [filteredRefs])

  // ── URL からメタ情報取得 ────────────────────────────────────────────────
  async function fetchMeta() {
    if (!addUrl.trim()) return
    setFetchLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/references/fetch-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFetchError('取得に失敗しました。URLを確認してください。')
      } else {
        setAddForm(prev => ({
          ...prev,
          title:         data.title ?? '',
          description:   data.description ?? '',
          thumbnail_url: data.thumbnail_url ?? '',
          orientation:   data.orientation ?? 'landscape',
          tags:          (data.tags ?? []).join(' '),
          company_name:  data.company_name ?? '',
          case_content:  data.case_content ?? '',
        }))
      }
    } catch {
      setFetchError('ネットワークエラーが発生しました')
    } finally {
      setFetchLoading(false)
    }
  }

  // ── リファレンス保存 ────────────────────────────────────────────────────
  async function handleSave() {
    if (!addUrl.trim()) return
    setSaving(true)
    const supabase = createClient()
    const tags = addForm.tags.split(/[\s,　、]+/).map(t => t.trim()).filter(Boolean)
    const { data, error } = await supabase
      .from('video_references')
      .insert({
        url:           addUrl.trim(),
        title:         addForm.title || null,
        description:   addForm.description || null,
        thumbnail_url: addForm.thumbnail_url || null,
        orientation:   addForm.orientation,
        folder_id:     addForm.folder_id || null,
        tags,
        company_name:  addForm.company_name || null,
        case_content:  addForm.case_content || null,
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setRefs(prev => [data as Reference, ...prev])
      closeAddModal()
    }
  }

  function closeAddModal() {
    setShowAddModal(false)
    setAddUrl('')
    setFetchError(null)
    setAddForm({ title: '', description: '', thumbnail_url: '', orientation: 'landscape', folder_id: '', tags: '', company_name: '', case_content: '' })
  }

  // ── フォルダ作成 ────────────────────────────────────────────────────────
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setFolderSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reference_folders')
      .insert({ name: newFolderName.trim(), color: newFolderColor })
      .select()
      .single()
    setFolderSaving(false)
    if (!error && data) {
      setFolders(prev => [...prev, data as ReferenceFolder])
      setShowFolderModal(false)
      setNewFolderName('')
      setNewFolderColor('#6366F1')
    }
  }

  // ── カード操作コールバック ──────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    setRefs(prev => prev.filter(r => r.id !== id))
  }, [])

  const handleMoveFolder = useCallback((id: string, folderId: string | null) => {
    setRefs(prev => prev.map(r => r.id === id ? { ...r, folder_id: folderId } : r))
  }, [])

  // ── グリッドカラム数 ────────────────────────────────────────────────────
  const gridClass = viewOrientation === 'portrait'
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 左サイドバー ── */}
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto">
        <div className="px-3 py-4 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">フォルダ</p>

          {/* すべて */}
          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors
              ${selectedFolder === null
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Folder className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left truncate">すべて</span>
            <span className="text-xs text-slate-400">{refs.length}</span>
          </button>

          {/* フォルダ一覧 */}
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFolder(f.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors
                ${selectedFolder === f.id
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: f.color }}
              />
              <span className="flex-1 text-left truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{folderCounts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* + 新規フォルダ */}
        <div className="mt-auto px-3 py-3 border-t border-slate-200">
          <button
            onClick={() => setShowFolderModal(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm
              text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            新規フォルダ
          </button>
        </div>
      </aside>

      {/* ── 右メインエリア ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ツールバー */}
        <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-3">
            {/* 検索 */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="タイトル・タグで検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* 向き切替 */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {([
                { val: 'all',       Icon: null,        label: 'すべて' },
                { val: 'landscape', Icon: Monitor,     label: '横型' },
                { val: 'portrait',  Icon: Smartphone,  label: '縦型' },
              ] as const).map(({ val, Icon, label }) => (
                <button
                  key={val}
                  onClick={() => setViewOrientation(val)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${viewOrientation === val
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </button>
              ))}
            </div>

            {/* 登録ボタン */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
                text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              登録
            </button>
          </div>

          {/* タグフィルター */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors
                    ${activeTag === tag
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* カードグリッド */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : filteredRefs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ExternalLink className="w-10 h-10 mb-3" />
              <p className="text-sm">リファレンスがありません</p>
              <p className="text-xs mt-1">「登録」ボタンから URL を追加してください</p>
            </div>
          ) : (
            <>
              {/* ピン済みセクション */}
              {pinnedRefs.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Pin className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600">ピン済み</span>
                    <div className="h-px flex-1 bg-amber-100" />
                  </div>
                  <div className={`grid gap-4 ${gridClass}`}>
                    {pinnedRefs.map(r => (
                      <ReferenceCard
                        key={r.id}
                        item={r}
                        folders={folders}
                        onDelete={handleDelete}
                        onMoveFolder={handleMoveFolder}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 通常セクション */}
              {regularRefs.length > 0 && (
                <div>
                  {pinnedRefs.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-slate-400">その他</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                  )}
                  <div className={`grid gap-4 ${gridClass}`}>
                    {regularRefs.map(r => (
                      <ReferenceCard
                        key={r.id}
                        item={r}
                        folders={folders}
                        onDelete={handleDelete}
                        onMoveFolder={handleMoveFolder}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          登録モーダル
      ══════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">リファレンスを登録</h2>
              <button
                onClick={closeAddModal}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* フォーム */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={addUrl}
                    onChange={e => setAddUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchMeta() }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={fetchMeta}
                    disabled={fetchLoading || !addUrl.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50
                      rounded-lg text-sm font-medium text-slate-700 transition-colors shrink-0"
                  >
                    {fetchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '取得'}
                  </button>
                </div>
                {fetchError && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
              </div>

              {/* サムネイルプレビュー */}
              {addForm.thumbnail_url && (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={addForm.thumbnail_url}
                    alt=""
                    className={`w-full object-cover ${addForm.orientation === 'portrait' ? 'max-h-48' : ''}`}
                  />
                </div>
              )}

              {/* タイトル */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">タイトル</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 企業名 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">企業名</label>
                <input
                  type="text"
                  placeholder="例: 株式会社○○"
                  value={addForm.company_name}
                  onChange={e => setAddForm(f => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 案件内容 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">案件内容</label>
                <textarea
                  placeholder="制作内容のメモ..."
                  value={addForm.case_content}
                  onChange={e => setAddForm(f => ({ ...f, case_content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* 向き */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">向き</label>
                <div className="flex gap-2">
                  {(['landscape', 'portrait'] as const).map(o => (
                    <button
                      key={o}
                      onClick={() => setAddForm(f => ({ ...f, orientation: o }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        border transition-colors
                        ${addForm.orientation === o
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'}`}
                    >
                      {o === 'landscape' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                      {o === 'landscape' ? '横型 (16:9)' : '縦型 (9:16)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* フォルダ */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">フォルダ</label>
                <select
                  value={addForm.folder_id}
                  onChange={e => setAddForm(f => ({ ...f, folder_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">なし</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* タグ */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  タグ <span className="text-slate-400">（スペース区切り）</span>
                </label>
                <input
                  type="text"
                  placeholder="採用 PR インタビュー"
                  value={addForm.tags}
                  onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeAddModal}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!addUrl.trim() || saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700
                  disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          フォルダ作成モーダル
      ══════════════════════════════════════════════════════════════════ */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">新規フォルダ</h2>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">フォルダ名 *</label>
                <input
                  type="text"
                  placeholder="例: 採用動画"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">カラー</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform
                        ${newFolderColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || folderSaving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700
                  disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {folderSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
