import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { email, role, name } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 })
  }

  const validRoles = ['admin', 'member', 'viewer']
  const assignedRole = validRoles.includes(role) ? role : 'member'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${appUrl}/auth/set-password`

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      name: name || '',
      role: assignedRole,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ user: data.user })
}
