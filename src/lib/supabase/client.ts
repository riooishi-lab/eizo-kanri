import { createBrowserClient } from '@supabase/ssr'

const SESSION_MAX_AGE = 90 * 24 * 60 * 60 // 90日（秒）

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: SESSION_MAX_AGE,
      },
    }
  )
}
