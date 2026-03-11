/**
 * 管理者判定ユーティリティ
 * rio.oishiのアカウントを管理者として扱う
 */
export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return email.startsWith('rio.oishi')
}
