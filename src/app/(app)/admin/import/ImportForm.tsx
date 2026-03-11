'use client'

import { useState } from 'react'
import { Upload, Eye, CheckCircle, AlertCircle, Download } from 'lucide-react'

// スプレッドシートの列順（コピペ用テンプレートと一致させる）
const COLUMNS = [
  { key: 'company_name',     label: '会社名',       required: true },
  { key: 'project_name',     label: '案件名',       required: true },
  { key: 'description',      label: '制作概要',     required: false },
  { key: 'production_staff', label: '制作担当',     required: false },
  { key: 'sales_staff',      label: '営業担当',     required: false },
  { key: 'status',           label: 'ステータス',   required: true },
  { key: 'priority',         label: '優先度',       required: true },
  { key: 'budget',           label: '制作予算',     required: false },
  { key: 'cost',             label: '原価',         required: false },
  { key: 'estimated_hours',  label: '予測工数',     required: false },
  { key: 'actual_hours',     label: '実工数',       required: false },
  { key: 'planning_hours',   label: '企画工数',     required: false },
  { key: 'shooting_hours',   label: '撮影工数',     required: false },
  { key: 'editing_hours',    label: '編集工数',     required: false },
  { key: 'storyboard_date',  label: 'コンテ提出日', required: false },
  { key: 'schedule_date',    label: '香盤提出日',   required: false },
  { key: 'shooting_date',    label: '撮影日',       required: false },
  { key: 'first_draft_date', label: '初稿提出日',   required: false },
  { key: 'final_date',       label: '校了/投稿日',  required: false },
  { key: 'notes',            label: '備考',         required: false },
]

const STATUS_MAP: Record<string, string> = {
  '未着手': '未着手', '撮影前': '撮影前', '編集中': '編集中',
  '先方確認中': '先方確認中', '校了': '校了',
}

const PRIORITY_MAP: Record<string, string> = {
  '高(must)': 'must', 'must': 'must', '高': 'must',
  '中(should)': 'should', 'should': 'should', '中': 'should',
  '低(want)': 'want', 'want': 'want', '低': 'want',
}

type ParsedRow = Record<string, string | number | null>
type ParseError = { row: number; message: string }

function parseNum(v: string): number | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null
  // ¥や,を除去
  const n = parseFloat(v.replace(/[¥,￥\s]/g, ''))
  return isNaN(n) ? null : n
}

function parseDate(v: string): string | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null
  // "9/19(金)" → "2026-09-19" (年は現在年を基準にする)
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const now = new Date()
    const month = parseInt(m[1])
    const day = parseInt(m[2])
    // 過去の月なら翌年と判断
    const year = (month < now.getMonth() + 1 - 6) ? now.getFullYear() + 1 : now.getFullYear()
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  // ISO形式はそのまま
  if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10)
  return null
}

function parseTsv(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  // 1行目がヘッダーかチェック（会社名 or company_name が含まれていたらスキップ）
  let startLine = 0
  const firstCols = lines[0]?.split('\t')
  if (firstCols && (firstCols[0].includes('会社名') || firstCols[0].toLowerCase().includes('company'))) {
    startLine = 1
  }

  for (let i = startLine; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    const row: ParsedRow = {}
    let hasRequired = true

    COLUMNS.forEach((col, idx) => {
      const raw = (cols[idx] || '').trim()

      if (col.key === 'status') {
        const mapped = STATUS_MAP[raw]
        if (!mapped && col.required) {
          errors.push({ row: i + 1, message: `行${i + 1}: ステータス「${raw}」が無効です（未着手/撮影前/編集中/先方確認中/校了）` })
          hasRequired = false
        }
        row[col.key] = mapped || raw || '未着手'
      } else if (col.key === 'priority') {
        const mapped = PRIORITY_MAP[raw]
        if (!mapped && col.required) {
          errors.push({ row: i + 1, message: `行${i + 1}: 優先度「${raw}」が無効です（高(must)/中(should)/低(want)）` })
          hasRequired = false
        }
        row[col.key] = mapped || 'should'
      } else if (['budget', 'cost', 'estimated_hours', 'actual_hours', 'planning_hours', 'shooting_hours', 'editing_hours'].includes(col.key)) {
        row[col.key] = parseNum(raw)
      } else if (['storyboard_date', 'schedule_date', 'shooting_date', 'first_draft_date', 'final_date'].includes(col.key)) {
        row[col.key] = parseDate(raw)
      } else {
        row[col.key] = raw || null
      }
    })

    if (!row.company_name || !row.project_name) {
      if (cols.some(c => c.trim())) {
        errors.push({ row: i + 1, message: `行${i + 1}: 会社名と案件名は必須です` })
      }
      continue
    }

    if (hasRequired) rows.push(row)
  }

  return { rows, errors }
}

function downloadTemplate() {
  const header = COLUMNS.map(c => c.label).join('\t')
  const sample = [
    '株式会社サンプル', 'サンプル動画制作', '企業紹介動画1本', '廣瀬', '塩田',
    '未着手', '中(should)', '300000', '99000', '50', '0', '10', '20', '20',
    '4/1(火)', '4/10(木)', '4/20(日)', '5/1(木)', '5/31(土)', '備考テキスト'
  ].join('\t')
  const blob = new Blob([header + '\n' + sample], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '案件一括登録テンプレート.tsv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportForm() {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handleParse() {
    const { rows, errors } = parseTsv(text)
    setParsed(rows)
    setParseErrors(errors)
    setSelected(new Set(rows.map((_, i) => i)))
    setResult(null)
    setImportError(null)
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(parsed!.map((_, i) => i)))
    else setSelected(new Set())
  }

  async function handleImport() {
    if (!parsed) return
    const targets = parsed.filter((_, i) => selected.has(i))
    if (targets.length === 0) return

    setImporting(true)
    setImportError(null)

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
      setText('')
      setParsed(null)
      setSelected(new Set())
    }
    setImporting(false)
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">案件一括登録</h1>
        <p className="text-slate-500 text-sm mt-1">スプレッドシートからコピーしたデータを貼り付けて一括登録できます</p>
      </div>

      {/* テンプレートDL */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">列の順番について</p>
          <p className="text-xs text-blue-600 mt-1">
            {COLUMNS.map(c => c.label).join(' → ')}
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          テンプレートDL
        </button>
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
          placeholder={`会社名\t案件名\t制作概要\t制作担当\t...\n株式会社○○\t採用動画\t...`}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300
              text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            <Eye className="w-4 h-4" />
            プレビュー
          </button>
          {parsed && (
            <span className="text-sm text-slate-500">
              {parsed.length}件 解析済み
            </span>
          )}
        </div>
      </div>

      {/* エラー */}
      {parseErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {parseErrors.length}件の警告（対象行はスキップされます）
          </p>
          <ul className="text-xs text-yellow-700 space-y-1">
            {parseErrors.map((e, i) => <li key={i}>• {e.message}</li>)}
          </ul>
        </div>
      )}

      {/* 結果メッセージ */}
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

      {/* プレビューテーブル */}
      {parsed && parsed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-800">
                プレビュー（{selected.size}/{parsed.length}件 選択中）
              </h2>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === parsed.length}
                  onChange={e => toggleAll(e.target.checked)}
                  className="rounded"
                />
                全選択
              </label>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300
                text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              {importing ? '登録中...' : `${selected.size}件を登録`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-8 px-3 py-2.5 text-left"></th>
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
                {parsed.map((row, i) => (
                  <tr
                    key={i}
                    className={`${selected.has(i) ? '' : 'opacity-40'} hover:bg-slate-50`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={e => {
                          const next = new Set(selected)
                          e.target.checked ? next.add(i) : next.delete(i)
                          setSelected(next)
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap max-w-[12rem] truncate">{row.company_name as string}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-[14rem] truncate">{row.project_name as string}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.production_staff as string || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.sales_staff as string || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${row.status === '校了' ? 'bg-green-100 text-green-700' :
                          row.status === '先方確認中' ? 'bg-blue-100 text-blue-700' :
                          row.status === '編集中' ? 'bg-yellow-100 text-yellow-700' :
                          row.status === '撮影前' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'}`}>
                        {row.status as string}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${row.priority === 'must' ? 'bg-red-100 text-red-700' :
                          row.priority === 'should' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'}`}>
                        {row.priority === 'must' ? '高' : row.priority === 'should' ? '中' : '低'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                      {row.budget != null ? `¥${(row.budget as number).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                      {row.estimated_hours != null ? `${row.estimated_hours}h` : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.shooting_date as string || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.final_date as string || '-'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[10rem] truncate">{row.notes as string || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
