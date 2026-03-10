export type ProjectStatus =
  | '未着手'
  | '撮影前'
  | '編集中'
  | '先方確認中'
  | '校了'

export type ProjectPriority = 'must' | 'should' | 'want'

export interface Project {
  id: string
  project_no: string
  company_name: string
  project_name: string
  description: string | null
  production_staff: string | null
  sales_staff: string | null
  status: ProjectStatus
  priority: ProjectPriority
  budget: number | null
  cost: number | null
  estimated_hours: number | null
  actual_hours: number | null
  planning_hours: number | null
  shooting_hours: number | null
  editing_hours: number | null
  storyboard_date: string | null
  schedule_date: string | null
  shooting_date: string | null
  first_draft_date: string | null
  final_date: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectHistory {
  id: string
  project_id: string
  changed_by: string
  change_type: 'create' | 'update' | 'delete'
  before_data: Partial<Project> | null
  after_data: Partial<Project> | null
  created_at: string
}

export const PROJECT_STATUSES: ProjectStatus[] = [
  '未着手',
  '撮影前',
  '編集中',
  '先方確認中',
  '校了',
]

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  未着手: 'bg-gray-100 text-gray-700 border-gray-300',
  撮影前: 'bg-blue-100 text-blue-700 border-blue-300',
  編集中: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  先方確認中: 'bg-purple-100 text-purple-700 border-purple-300',
  校了: 'bg-green-100 text-green-700 border-green-300',
}

export const PROJECT_STATUS_HEADER_COLORS: Record<ProjectStatus, string> = {
  未着手: 'bg-gray-500',
  撮影前: 'bg-blue-500',
  編集中: 'bg-yellow-500',
  先方確認中: 'bg-purple-500',
  校了: 'bg-green-500',
}

export const PROJECT_PRIORITY_COLORS: Record<ProjectPriority, string> = {
  must: 'bg-red-100 text-red-700 border-red-300',
  should: 'bg-orange-100 text-orange-700 border-orange-300',
  want: 'bg-sky-100 text-sky-700 border-sky-300',
}
