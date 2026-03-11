'use client'

import { useState } from 'react'
import { Upload, Eye, CheckCircle, AlertCircle, Download, ChevronDown, ChevronRight } from 'lucide-react'

// ---- 定数 ----------------------------------------------------------------

const VALID_STATUSES = ['未着手', '撮影前', '編集中', '先方確認中', '校了'] as const
type ValidStatus = typeof VALID_STATUSES[number]

const STATUS_MAP: Record<string, ValidStatus> = {
  '未着手': '未着手', '撮影前': '撮影前', '編集中': '編集中',
  '先方確認中': '先方確認中', '校了': '校了',
  '済み': '校了', '済': '校了', '完了': '校了',
}

const PRIORITY_MAP: Record<string, string> = {
  '高(must)': 'must', 'must': 'must', '高': 'must',
  '中(should)': 'should', 'should': 'should', '中': 'should',
  '低(want)': 'want', 'want': 'want', '低': 'want',
}

const STATUS_COLORS: Record<string, string> = {
  '校了':      'bg-green-100 text-green-700',
  '先方確認中': 'bg-blue-100 text-blue-700',
  '編集中':    'bg-yellow-100 text-yellow-700',
  '撮影前':    'bg-orange-100 text-orange-700',
  '未着手':    'bg-slate-100 text-slate-600',
}

// テンプレート列順（コピペ用）
const TEMPLATE_COLS = [
  '会社名', '案件名', '制作概要', '制作担当', '営業担当',
  'ステータス', '優先度', '制作予算', '原価', '予測工数', '実工数',
  '企画工数', '撮影工数', '編集工数', 'コンテ提出日', '香盤提出日',
  '撮影日', '初稿提出日', '校了/投稿日', '備考',
]

// スプレッドシート形式の列マッピング
// [0]=No.(skip), [1]=ステータス, [2]=優先度 or 会社名, ...
const SS_COLS_WITH_PRIORITY = [
  null, 'status', 'priority', 'company_name', 'project_name',
  'description', 'production_staff', 'sales_staff',
  'budget', 'cost', 'estimated_hours', 'actual_hours',
  'planning_hours', 'shooting_hours', 'editing_hours',
  null, null, null, // 本来獲得すべき予算, slack, 制作管理シート
  'storyboard_date', 'schedule_date', 'shooting_date',
  'first_draft_date', 'final_date', 'notes',
]

const SS_COLS_NO_PRIORITY = [
  null, 'status', 'company_name', 'project_name',
  'description', 'production_staff', 'sales_staff',
  'budget', 'cost', 'estimated_hours', 'actual_hours',
  'planning_hours', 'shooting_hours', 'editing_hours',
  null, null, null, // 本来獲得すべき予算, slack, 制作管理シート
  'storyboard_date', 'schedule_date', 'shooting_date',
  'first_draft_date', 'final_date', 'notes',
]

// ---- パーサー ----------------------------------------------------------------

/** 引用符・複数行セルを正しく扱う TSV パーサー */
function parseTsvRaw(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue }
        inQuotes = false
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === '\t') { row.push(cell); cell = '' }
      else if (ch === '\n') {
        row.push(cell); cell = ''
        if (row.some(c => c.trim())) rows.push(row)
        row = []
      } else if (ch !== '\r') { cell += ch }
    }
    i++
  }
  row.push(cell)
  if (row.some(c => c.trim())) rows.push(row)
  return rows
}

function parseNum(v: string): number | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null
  const n = parseFloat(v.replace(/[¥,￥\s]/g, ''))
  return isNaN(n) ? null : n
}

function parseDate(v: string): string | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null
  const clean = v.trim().split(/[,\s]/)[0] // "7/14,16" → "7/14"
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const now = new Date()
    const month = parseInt(m[1])
    const day = parseInt(m[2])
    const year = month < now.getMonth() + 1 - 6 ? now.getFullYear() + 1 : now.getFullYear()
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10)
  return null
}

// ---- 型定義 ----------------------------------------------------------------

type ParsedRow = {
  company_name: string
  project_name: string
  description: string | null
  production_staff: string | null
  sales_staff: string | null
  status: ValidStatus
  priority: string
  budget: number | null
  cost: number | null
  estimated_hours: number | null
  actual_hours: number | null
  planning_hours: number | null
  shooting_hours: number | null
  editing_hours: number | null
  storyboard_date: string | null
  schedule_date: string | null
  shooting_date: string | null
  first_draft_date: string | null
  final_date: string | null
  notes: string | null
  _needsStatus: boolean  // ステータスを要入力
  _isCompleted: boolean  // 完了（校了）扱い
}

// ---- メインパース ----------------------------------------------------------------

function parseData(text: string): { rows: ParsedRow[]; skipped: number } {
  const rawRows = parseTsvRaw(text)
  if (rawRows.length === 0) return { rows: [], skipped: 0 }

  // ヘッダー行スキップ
  let startIdx = 0
  const firstRow = rawRows[0]
  if (firstRow[0] === '会社名' || firstRow[0] === 'No.' || firstRow[0] === 'No'
    || firstRow[0].toLowerCase() === 'company_name') {
    startIdx = 1
  }

  // フォーマット自動検出
  const sample = rawRows[startIdx] ?? []
  const isSpreadsheetFormat = /^\d+$/.test(sample[0]?.trim() ?? '')

  let colMap: (string | null)[] = TEMPLATE_COLS.map((label, i) => {
    const keyMap: Record<string, string> = {
      '会社名': 'company_name', '案件名': 'project_name', '制作概要': 'description',
      '制作担当': 'production_staff', '営業担当': 'sales_staff',
      'ステータス': 'status', '優先度': 'priority', '制作予算': 'budget',
      '原価': 'cost', '予測工数': 'estimated_hours', '実工数': 'actual_hours',
      '企画工数': 'planning_hours', '撮影工数': 'shooting_hours', '編集工数': 'editing_hours',
      'コンテ提出日': 'storyboard_date', '香盤提出日': 'schedule_date',
      '撮影日': 'shooting_date', '初稿提出日': 'first_draft_date',
      '校了/投稿日': 'final_date', '備考': 'notes',
    }
    return keyMap[label] ?? null
  })

  if (isSpreadsheetFormat) {
    // 列2が優先度値かどうかで判定
    const col2 = sample[2]?.trim() ?? ''
    const hasPriority = !!PRIORITY_MAP[col2] || col2 === ''
    colMap = hasPriority ? SS_COLS_WITH_PRIORITY : SS_COLS_NO_PRIORITY
  }

  const rows: ParsedRow[] = []
  let skipped = 0

  for (let i = startIdx; i < rawRows.length; i++) {
    const cols = rawRows[i]

    // 全列空白スキップ
    if (!cols.some(c => c.trim())) { skipped++; continue }

    const get = (key: string): string => {
      const idx = colMap.indexOf(key)
      return idx >= 0 ? (cols[idx] ?? '').trim() : ''
    }

    const rawStatus = get('status')
    const mappedStatus = STATUS_MAP[rawStatus]
    const needsStatus = !mappedStatus && rawStatus !== ''
    const missingStatus = rawStatus === ''

    const rawPriority = get('priority')
    const mappedPriority = PRIORITY_MAP[rawPriority] ?? 'should'

    const company = get('company_name')
    const project = get('project_name')

    // 会社名・案件名が両方空ならスキップ（完全空行）
    if (!company && !project) { skipped++; continue }
    // 片方でも数字だけならスキップ（列ズレ行）
    if (/^\d+(\.\d+)?$/.test(company) && !project) { skipped++; continue }

    rows.push({
      company_name:     company || '(未設定)',
      project_name:     project || '(未設定)',
      description:      get('description') || null,
      production_staff: get('production_staff') || null,
      sales_staff:      get('sales_staff') || null,
      status:           (mappedStatus ?? '未着手') as ValidStatus,
      priority:         mappedPriority,
      budget:           parseNum(get('budget')),
      cost:             parseNum(get('cost')),
      estimated_hours:  parseNum(get('estimated_hours')),
      actual_hours:     parseNum(get('actual_hours')),
      planning_hours:   parseNum(get('planning_hours')),
      shooting_hours:   parseNum(get('shooting_hours')),
      editing_hours:    parseNum(get('editing_hours')),
      storyboard_date:  parseDate(get('storyboard_date')),
      schedule_date:    parseDate(get('schedule_date')),
      shooting_date:    parseDate(get('shooting_date')),
      first_draft_date: parseDate(get('first_draft_date')),
      final_date:       parseDate(get('final_date')),
      notes:            get('notes') || null,
      _needsStatus:     needsStatus || missingStatus,
      _isCompleted:     mappedStatus === '校了',
    })
  }

  return { rows, skipped }
}

function downloadTemplate() {
  const header = TEMPLATE_COLS.join('\t')
  const sample = [
    '株式会社サンプル', 'サンプル動画制作', '企業紹介動画1本', '廣瀬', '塩田',
    '未着手', '中(should)', '300000', '99000', '50', '0', '10', '20', '20',
    '4/1(火)', '4/10(木)', '4/20(日)', '5/1(木)', '5/31(土)', '備考テキスト',
  ].join('\t')
  const blob = new Blob([header + '\n' + sample], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = '案件一括登録テンプレート.tsv'; a.click()
  URL.revokeObjectURL(url)
}

// ---- コンポーネント ----------------------------------------------------------------

export default function ImportForm() {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [statusOverrides, setStatusOverrides] = useState<Record<number, ValidStatus>>({})
  const [selectedActive, setSelectedActive] = useState<Set<number>>(new Set())
  const [selectedCompleted, setSelectedCompleted] = useState<Set<number>>(new Set())
  const [completedOpen, setCompletedOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handleParse() {
    const { rows, skipped: sk } = parseData(text)
    setParsed(rows)
    setSkipped(sk)
    setStatusOverrides({})
    setResult(null)
    setImportError(null)

    const active = new Set(
      rows.map((r, i) => (!r._isCompleted ? i : -1)).filter(i => i >= 0)
    )
    const completed = new Set(
      rows.map((r, i) => (r._isCompleted ? i : -1)).filter(i => i >= 0)
    )
    setSelectedActive(active)
    setSelectedCompleted(completed)
    if (completed.size > 0) setCompletedOpen(true)
  }

  function setOverrideStatus(idx: number, status: ValidStatus) {
    setStatusOverrides(prev => ({ ...prev, [idx]: status }))
  }

  function getEffectiveRow(row: ParsedRow, idx: number): ParsedRow {
    if (statusOverrides[idx]) {
      return { ...row, status: statusOverrides[idx], _needsStatus: false }
    }
    return row
  }

  async function handleImport(indices: Set<number>) {
    if (!parsed || indices.size === 0) return

    const targets = [...indices].map(i => {
      const row = getEffectiveRow(parsed[i], i)
      // _needsStatus と _isCompleted は DB に送らない
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _needsStatus, _isCompleted, ...rest } = row
      return rest
    }).filter(r => r.company_name && r.project_name)

    // ステータス未入力のものが含まれていたら警告
    const stillNeedsStatus = [...indices].filter(i => {
      const row = getEffectiveRow(parsed[i], i)
      return row._needsStatus
    })
    if (stillNeedsStatus.length > 0 && !confirm(`${stillNeedsStatus.length}件のステータスが未入力です。「未着手」として登録しますか？`)) {
      return
    }

    setImporting(true); setImportError(null)
    const res = await fetch('/api/admin/import-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: targets }),
    })
    const data = await res.json()
    if (!res.ok) {
      setImportError(data.error || '登録に失敗しました')
    } else {
      setResult({ inserted: data.inserted })
      setText(''); setParsed(null)
      setSelectedActive(new Set()); setSelectedCompleted(new Set())
    }
    setImporting(false)
  }

  const activeRows = parsed?.map((r, i) => ({ row: r, i })).filter(({ row }) => !row._isCompleted) ?? []
  const completedRows = parsed?.map((r, i) => ({ row: r, i })).filter(({ row }) => row._isCompleted) ?? []
  const needsStatusCount = activeRows.filter(({ row, i }) => getEffectiveRow(row, i)._needsStatus).length

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">案件一括登録</h1>
        <p className="text-slate-500 text-sm mt-1">スプレッドシートからコピーしたデータを貼り付けて一括登録できます</p>
      </div>

      {/* 列順説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 mb-1">対応フォーマット</p>
            <p className="text-xs text-blue-700 font-medium">テンプレート形式：</p>
            <p className="text-xs text-blue-600">{TEMPLATE_COLS.join(' → ')}</p>
            <p className="text-xs text-blue-700 font-medium mt-1.5">スプレッドシート形式（自動検出）：</p>
            <p className="text-xs text-blue-600">No. → ステータス → 会社名 → 案件名 → 制作概要 → ...</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />テンプレートDL
          </button>
        </div>
      </div>

      {/* ペーストエリア */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          スプレッドシートからコピーしたデータを貼り付け
        </label>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setParsed(null); setResult(null) }}
          rows={8}
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          placeholder="スプレッドシートのセルを選択してコピー(⌘C)後、ここに貼り付け..."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300
              text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            <Eye className="w-4 h-4" />プレビュー
          </button>
          {parsed !== null && (
            <span className="text-sm text-slate-500">
              {parsed.length}件 解析済み
              {skipped > 0 && <span className="ml-2 text-slate-400">（{skipped}行スキップ）</span>}
            </span>
          )}
        </div>
      </div>

      {/* ステータス未入力の案内 */}
      {needsStatusCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {needsStatusCount}件のステータスが不明です
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              下の表のドロップダウンからステータスを選択してください。未選択のまま登録すると「未着手」になります。
            </p>
          </div>
        </div>
      )}

      {/* 結果・エラー */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">{result.inserted}件の案件を登録しました</p>
        </div>
      )}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{importError}</p>
        </div>
      )}

      {/* ── 進行中案件 ── */}
      {activeRows.length > 0 && (
        <ProjectTable
          title="進行中案件"
          rows={activeRows}
          selected={selectedActive}
          setSelected={setSelectedActive}
          statusOverrides={statusOverrides}
          setOverrideStatus={setOverrideStatus}
          onImport={() => handleImport(selectedActive)}
          importing={importing}
          accentColor="indigo"
        />
      )}

      {/* ── 完了案件 ── */}
      {completedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setCompletedOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {completedOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              <h2 className="text-sm font-semibold text-slate-800">
                完了案件（済み / 校了）
              </h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {completedRows.length}件
              </span>
            </div>
            <span className="text-xs text-slate-400">クリックして{completedOpen ? '閉じる' : '開く'}</span>
          </button>

          {completedOpen && (
            <>
              <div className="flex items-center justify-between px-5 py-3 bg-green-50">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCompleted.size === completedRows.length}
                      onChange={e => setSelectedCompleted(
                        e.target.checked ? new Set(completedRows.map(({ i }) => i)) : new Set()
                      )}
                      className="rounded"
                    />
                    全選択
                  </label>
                  <span className="text-xs text-slate-500">{selectedCompleted.size}/{completedRows.length}件 選択中</span>
                </div>
                <button
                  onClick={() => handleImport(selectedCompleted)}
                  disabled={importing || selectedCompleted.size === 0}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300
                    text-white font-medium py-1.5 px-3 rounded-lg text-xs transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? '登録中...' : `${selectedCompleted.size}件を完了として登録`}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">会社名</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">案件名</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">制作担当</th>
                      <th className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">予算</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">撮影日</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">校了日</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedRows.map(({ row, i }) => (
                      <tr key={i} className={`${selectedCompleted.has(i) ? 'bg-green-50/40' : 'opacity-40'} hover:bg-green-50/60`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedCompleted.has(i)}
                            onChange={e => {
                              const next = new Set(selectedCompleted)
                              e.target.checked ? next.add(i) : next.delete(i)
                              setSelectedCompleted(next)
                            }} className="rounded" />
                        </td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[12rem] truncate">{row.company_name}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-[14rem] truncate">{row.project_name}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.production_staff || '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                          {row.budget != null ? `¥${row.budget.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.shooting_date || '-'}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.final_date || '-'}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[10rem] truncate">{row.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---- 進行中テーブルコンポーネント ----------------------------------------------------------------

type ProjectTableProps = {
  title: string
  rows: { row: ParsedRow; i: number }[]
  selected: Set<number>
  setSelected: (s: Set<number>) => void
  statusOverrides: Record<number, ValidStatus>
  setOverrideStatus: (idx: number, status: ValidStatus) => void
  onImport: () => void
  importing: boolean
  accentColor: 'indigo' | 'green'
}

function ProjectTable({
  title, rows, selected, setSelected,
  statusOverrides, setOverrideStatus,
  onImport, importing, accentColor,
}: ProjectTableProps) {
  const accent = accentColor === 'indigo'
    ? { bg: 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300', header: '' }
    : { bg: 'bg-green-600 hover:bg-green-700 disabled:bg-green-300', header: 'bg-green-50' }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${accent.header}`}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === rows.length && rows.length > 0}
              onChange={e => setSelected(
                e.target.checked ? new Set(rows.map(({ i }) => i)) : new Set()
              )}
              className="rounded"
            />
            全選択
          </label>
          <span className="text-xs text-slate-400">{selected.size}/{rows.length}件 選択中</span>
        </div>
        <button
          onClick={onImport}
          disabled={importing || selected.size === 0}
          className={`flex items-center gap-1.5 ${accent.bg} text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors`}
        >
          <Upload className="w-4 h-4" />
          {importing ? '登録中...' : `${selected.size}件を登録`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-8 px-3 py-2.5"></th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">会社名</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">案件名</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">制作担当</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">営業担当</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">ステータス</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">優先度</th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">予算</th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">予測工数</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">撮影日</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">校了日</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ row, i }) => {
              const effective = statusOverrides[i]
                ? { ...row, status: statusOverrides[i], _needsStatus: false }
                : row
              const needsStatus = effective._needsStatus

              return (
                <tr
                  key={i}
                  className={`${selected.has(i) ? '' : 'opacity-40'} ${needsStatus ? 'bg-orange-50/60' : ''} hover:bg-slate-50`}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(i)}
                      onChange={e => {
                        const next = new Set(selected)
                        e.target.checked ? next.add(i) : next.delete(i)
                        setSelected(next)
                      }} className="rounded" />
                  </td>
                  <td className="px-3 py-2 text-slate-800 whitespace-nowrap max-w-[12rem] truncate">{row.company_name}</td>
                  <td className="px-3 py-2 text-slate-800 max-w-[14rem] truncate">{row.project_name}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.production_staff || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.sales_staff || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {needsStatus ? (
                      <select
                        value={statusOverrides[i] ?? ''}
                        onChange={e => setOverrideStatus(i, e.target.value as ValidStatus)}
                        className="border border-orange-300 rounded px-1.5 py-0.5 text-xs bg-orange-50 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      >
                        <option value="">-- 選択 --</option>
                        {VALID_STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[effective.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {effective.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                      ${effective.priority === 'must' ? 'bg-red-100 text-red-700' :
                        effective.priority === 'should' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'}`}>
                      {effective.priority === 'must' ? '高' : effective.priority === 'should' ? '中' : '低'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                    {row.budget != null ? `¥${row.budget.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                    {row.estimated_hours != null ? `${row.estimated_hours}h` : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.shooting_date || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.final_date || '-'}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[10rem] truncate">{row.notes || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
