import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncUserCalendar } from '@/lib/calendar/syncUser'

/**
 * POST /api/calendar/sync
 * ログイン中のユーザーの Google Calendar を同期する
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await syncUserCalendar(user.id, supabase)

  if ('error' in result) {
    const statusMap: Record<string, number> = {
      google_not_connected:   400,
      token_expired_no_refresh: 400,
      token_refresh_failed:   400,
      calendar_fetch_failed:  500,
      db_upsert_failed:       500,
    }
    return NextResponse.json(
      { error: result.error },
      { status: statusMap[result.error] ?? 500 }
    )
  }

  return NextResponse.json(result)
}
