export type ReferenceOrientation = 'landscape' | 'portrait'

export interface ReferenceFolder {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Reference {
  id: string
  url: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  orientation: ReferenceOrientation
  folder_id: string | null
  tags: string[]
  // 詳細フィールド（add_reference_details.sql で追加）
  company_name: string | null
  prefecture: string | null
  case_content: string | null
  is_pinned: boolean
  created_at: string
}

export interface ReferenceTimestamp {
  id: string
  reference_id: string
  time_seconds: number
  memo: string | null
  created_at: string
}
