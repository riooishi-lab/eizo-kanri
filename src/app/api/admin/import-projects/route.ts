import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

type ProjectRow = {
  company_name: string
  project_name: string
  description?: string
  production_staff?: string
  sales_staff?: string
  status: string
  priority: string
  budget?: number | null
  cost?: number | null
  estimated_hours?: number | null
  actual_hours?: number | null
  planning_hours?: number | null
  shooting_hours?: number | null
  editing_hours?: number | null
  storyboard_date?: string | null
  schedule_date?: string | null
  shooting_date?: string | null
  first_draft_date?: string | null
  final_date?: string | null
  notes?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { projects }: { projects: ProjectRow[] } = await req.json()

  if (!projects || !Array.isArray(projects) || projects.length === 0) {
    return NextResponse.json({ error: '登録するデータがありません' }, { status: 400 })
  }

  // project_no をトリガーに頼らず明示的に採番する
  // （Supabase環境でトリガーが適用されていない場合のフォールバック）
  const projectsWithNo = await Promise.all(
    projects.map(async (p) => {
      const { data: no } = await supabase.rpc('generate_project_no')
      return { ...p, project_no: no as string }
    })
  )

  const { data, error } = await supabase
    .from('projects')
    .insert(projectsWithNo)
    .select('id, project_no')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ inserted: data.length, projects: data })
}
