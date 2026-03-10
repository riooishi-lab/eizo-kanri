import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Service Role クライアント（RLSをバイパスする）
 * サーバーサイド専用。ブラウザからは絶対に使わないこと。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
