import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import ImportForm from './ImportForm'

export const dynamic = 'force-dynamic'

export default async function AdminImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    redirect('/projects')
  }

  return <ImportForm />
}
