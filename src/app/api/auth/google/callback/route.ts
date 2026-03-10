import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/google/callback
 * Google OAuth コールバック：コードをトークンに交換して保存する
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin   = request.nextUrl.origin
  const settingsUrl = `${origin}/settings/google`

  // ── エラー / パラメータ不足 ──
  if (error) {
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_request`)
  }

  // ── state 検証（CSRF 防止）──
  const storedState = request.cookies.get('google_oauth_state')?.value
  if (!storedState || state !== storedState) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`)
  }

  // ── コード → トークン交換 ──
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('[Google OAuth] token exchange failed:', body)
    return NextResponse.redirect(`${settingsUrl}?error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token?: string
    expires_in:    number
    scope:         string
  }

  // ── Google ユーザー情報取得（連携メールアドレス）──
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const googleUser = userInfoRes.ok
    ? (await userInfoRes.json() as { email?: string })
    : { email: undefined }

  // ── Supabase ユーザー確認 ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // ── トークンを DB に保存（既存レコードは上書き）──
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const upsertData: Record<string, unknown> = {
    user_id:      user.id,
    access_token: tokens.access_token,
    expires_at:   expiresAt,
    scope:        tokens.scope,
    google_email: googleUser.email ?? null,
  }
  // refresh_token は初回または再認証時のみ含まれる
  if (tokens.refresh_token) {
    upsertData.refresh_token = tokens.refresh_token
  }

  const { error: dbError } = await supabase
    .from('google_tokens')
    .upsert(upsertData, { onConflict: 'user_id' })

  if (dbError) {
    console.error('[Google OAuth] DB upsert failed:', dbError)
    return NextResponse.redirect(`${settingsUrl}?error=db_error`)
  }

  // ── state Cookie を削除してリダイレクト ──
  const response = NextResponse.redirect(`${settingsUrl}?success=connected`)
  response.cookies.delete('google_oauth_state')
  return response
}
