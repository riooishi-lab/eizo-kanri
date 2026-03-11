import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 既存の最大 project_no を取得し、次の採番値を返す。
 * DBのトリガー・関数に依存しない JS 実装。
 *
 * @param supabase - Supabase クライアント（server/client 両対応）
 * @param count    - 連続採番する件数（一括登録用）
 * @returns 'EK-000001' 形式の文字列配列
 */
export async function getNextProjectNos(
  supabase: SupabaseClient,
  count = 1
): Promise<string[]> {
  const { data } = await supabase
    .from('projects')
    .select('project_no')
    .like('project_no', 'EK-%')
    .order('project_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextSeq = 1
  if (data?.project_no) {
    const m = (data.project_no as string).match(/EK-(\d+)$/)
    if (m) nextSeq = parseInt(m[1]) + 1
  }

  return Array.from({ length: count }, (_, i) =>
    `EK-${String(nextSeq + i).padStart(6, '0')}`
  )
}
