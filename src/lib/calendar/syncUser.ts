import type { SupabaseClient } from '@supabase/supabase-js'

// ── 作業種別 正規化マップ ──────────────────────────────────────────────────
const WORK_TYPE_MAP: Array<{ patterns: RegExp; normalized: string }> = [
  { patterns: /編集|edit/i,                       normalized: '編集' },
  { patterns: /撮影|shoot/i,                      normalized: '撮影' },
  { patterns: /企画|plan|構成/i,                  normalized: '企画' },
  { patterns: /段取り|prep/i,                     normalized: '段取り' },
  { patterns: /打合せ|打ち合わせ|meeting|mtg/i,  normalized: '打合せ' },
]

function normalizeWorkType(raw: string): string {
  for (const { patterns, normalized } of WORK_TYPE_MAP) {
    if (patterns.test(raw)) return normalized
  }
  return 'その他'
}

// ── タイトルパース：「【企業名】案件名/作業名」形式 ──────────────────────
function parseEventTitle(title: string): {
  companyName: string
  projectName: string
  workType:    string
} | null {
  const match = title.match(/^【(.+?)】(.+?)\/(.+)$/)
  if (!match) return null
  return {
    companyName: match[1].trim(),
    projectName: match[2].trim(),
    workType:    normalizeWorkType(match[3].trim()),
  }
}

// ── アクセストークン リフレッシュ ─────────────────────────────────────────
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) return null
  return res.json()
}

type SyncTarget = {
  google_event_id:    string
  google_event_title: string
  company_name:       string
  project_name:       string
  work_type:          string
  date:               string
  hours:              number | null
  notes:              string | null
}

export type SyncResult =
  | { synced: number; skipped: number }
  | { error: string }

/**
 * 指定ユーザーの Google Calendar を同期して work_logs に保存する
 * supabase は Service Role クライアント or ユーザーセッションクライアントを渡す
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncUserCalendar(userId: string, supabase: SupabaseClient<any, any, any>): Promise<SyncResult> {
  // ── google_tokens 取得 ──
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (tokenErr || !tokenRow) {
    return { error: 'google_not_connected' }
  }

  // ── トークン有効期限チェック & リフレッシュ ──
  let accessToken: string = tokenRow.access_token
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const isExpired  = expiresAt - Date.now() < 60_000

  if (isExpired) {
    if (!tokenRow.refresh_token) {
      return { error: 'token_expired_no_refresh' }
    }
    const newTokens = await refreshAccessToken(tokenRow.refresh_token)
    if (!newTokens) {
      return { error: 'token_refresh_failed' }
    }
    accessToken = newTokens.access_token
    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
    await supabase.from('google_tokens')
      .update({ access_token: accessToken, expires_at: newExpiresAt })
      .eq('user_id', userId)
  }

  // ── Google Calendar イベント取得（過去90日〜未来30日）──
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const calendarRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '500',
    }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!calendarRes.ok) {
    const body = await calendarRes.text()
    console.error(`[Calendar Sync] events fetch failed for user ${userId}:`, body)
    return { error: 'calendar_fetch_failed' }
  }

  type CalendarEvent = {
    id: string
    summary?: string
    description?: string
    start: { date?: string; dateTime?: string }
    end:   { date?: string; dateTime?: string }
  }
  const calendarData = await calendarRes.json() as { items?: CalendarEvent[] }
  const events: CalendarEvent[] = calendarData.items ?? []

  // ── 対象イベントを絞り込み & パース ──
  const targets = events
    .map((ev): SyncTarget | null => {
      if (!ev.summary) return null
      const parsed = parseEventTitle(ev.summary)
      if (!parsed) return null

      const startStr = ev.start.date ?? ev.start.dateTime
      if (!startStr) return null

      let hours: number | null = null
      if (ev.start.dateTime && ev.end.dateTime) {
        const diffMs = new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()
        hours = Math.round((diffMs / 3_600_000) * 10) / 10
      }

      return {
        google_event_id:    ev.id,
        google_event_title: ev.summary,
        company_name:       parsed.companyName,
        project_name:       parsed.projectName,
        work_type:          parsed.workType,
        date:               startStr.slice(0, 10),
        hours,
        notes: ev.description ?? null,
      }
    })
    .filter((t): t is SyncTarget => t !== null)

  if (targets.length === 0) {
    await supabase.from('google_tokens')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
    return { synced: 0, skipped: 0 }
  }

  // ── 企業名＋案件名 → project_id マッピング ──
  const companyNames = [...new Set(targets.map(t => t.company_name))]
  const { data: projects } = await supabase
    .from('projects')
    .select('id, company_name, project_name')
    .in('company_name', companyNames)
    .is('deleted_at', null)

  const exactMap = new Map<string, string>()
  const companyMap = new Map<string, string[]>()
  for (const p of projects ?? []) {
    exactMap.set(`${p.company_name}::${p.project_name}`, p.id)
    const list = companyMap.get(p.company_name) ?? []
    list.push(p.id)
    companyMap.set(p.company_name, list)
  }

  function resolveProjectId(t: SyncTarget): string | null {
    const exact = exactMap.get(`${t.company_name}::${t.project_name}`)
    if (exact) return exact
    const list = companyMap.get(t.company_name) ?? []
    if (list.length === 1) return list[0]
    return null
  }

  // ── work_logs に upsert ──
  const rows = targets.map(t => ({
    user_id:            userId,
    google_event_id:    t.google_event_id,
    google_event_title: t.google_event_title,
    company_name:       t.company_name,
    project_name:       t.project_name,
    project_id:         resolveProjectId(t),
    date:               t.date,
    work_type:          t.work_type,
    hours:              t.hours,
    notes:              t.notes,
  }))

  const { error: upsertErr, count } = await supabase
    .from('work_logs')
    .upsert(rows, { onConflict: 'google_event_id', count: 'exact' })

  if (upsertErr) {
    console.error(`[Calendar Sync] upsert failed for user ${userId}:`, upsertErr)
    return { error: 'db_upsert_failed' }
  }

  await supabase.from('google_tokens')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)

  return {
    synced:  count ?? rows.length,
    skipped: rows.filter(r => r.project_id === null).length,
  }
}
