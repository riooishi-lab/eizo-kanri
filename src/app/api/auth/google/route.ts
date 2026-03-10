import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/google
 * Google OAuth 認証フローを開始する
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  // CSRF 防止用のランダムな state を生成
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent', // 毎回 refresh_token を取得するため
    state,
  })

  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  const response = NextResponse.redirect(redirectUrl)

  // state を HttpOnly Cookie に保存（10分間有効）
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600,
    path:     '/',
    sameSite: 'lax',
  })

  return response
}
