import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { getNextProjectNos } from '@/lib/project-no'

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

  // DBのトリガー・関数に依存せず JS 側で連番採番
  const projectNos = await getNextProjectNos(supabase, projects.length)
  const projectsWithNo = projects.map((p, i) => ({ ...p, project_no: projectNos[i] }))

  const { data, error } = await supabase
    .from('projects')
    .insert(projectsWithNo)
    .select('id, project_no')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ inserted: data.length, projects: data })
}
