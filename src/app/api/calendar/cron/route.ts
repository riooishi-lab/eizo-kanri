import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncUserCalendar } from '@/lib/calendar/syncUser'

/**
 * GET /api/calendar/cron
 * Vercel Cron Jobs から1時間ごとに呼ばれる。
 * Authorization: Bearer <CRON_SECRET> で保護。
 */
export async function GET(request: NextRequest) {
  // ── 認証チェック ──
  const authHeader = request.headers.get('authorization')
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()

  // ── google_tokens が存在する全ユーザーを取得 ──
  const { data: tokens, error } = await adminClient
    .from('google_tokens')
    .select('user_id')

  if (error) {
    console.error('[Cron] Failed to fetch google_tokens:', error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ processed: 0, synced: 0, skipped: 0, errors: 0 })
  }

  // ── 全ユーザーを並列同期 ──
  const results = await Promise.allSettled(
    tokens.map(t => syncUserCalendar(t.user_id, adminClient))
  )

  let totalSynced  = 0
  let totalSkipped = 0
  let totalErrors  = 0

  for (const r of results) {
    if (r.status === 'rejected') {
      totalErrors++
    } else if ('error' in r.value) {
      totalErrors++
    } else {
      totalSynced  += r.value.synced
      totalSkipped += r.value.skipped
    }
  }

  console.log(`[Cron] processed=${tokens.length} synced=${totalSynced} skipped=${totalSkipped} errors=${totalErrors}`)

  return NextResponse.json({
    processed: tokens.length,
    synced:    totalSynced,
    skipped:   totalSkipped,
    errors:    totalErrors,
  })
}
