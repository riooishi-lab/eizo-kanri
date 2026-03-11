'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Trash2, RefreshCw, Shield, User, Eye } from 'lucide-react'

type SupabaseUser = {
  id: string
  email?: string
  user_metadata?: { name?: string; role?: string }
  created_at: string
  last_sign_in_at?: string
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin: {
    label: '管理者',
    color: 'bg-purple-100 text-purple-700',
    icon: <Shield className="w-3 h-3" />,
  },
  member: {
    label: 'メンバー',
    color: 'bg-blue-100 text-blue-700',
    icon: <User className="w-3 h-3" />,
  },
  viewer: {
    label: '閲覧のみ',
    color: 'bg-slate-100 text-slate-600',
    icon: <Eye className="w-3 h-3" />,
  },
}

function RoleBadge({ role }: { role?: string }) {
  const r = role && ROLE_LABELS[role] ? ROLE_LABELS[role] : ROLE_LABELS.member
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
      {r.icon}
      {r.label}
    </span>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState<SupabaseUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (data.users) {
      setUsers(data.users)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setInviting(true)
    setMessage(null)

    const res = await fetch('/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role }),
    })
    const data = await res.json()

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'エラーが発生しました' })
    } else {
      const text = data.resent
        ? `${email} はすでに登録済みのため、パスワードリセットメールを送信しました`
        : `${email} に招待メールを送信しました`
      setMessage({ type: 'success', text })
      setEmail('')
      setName('')
      setRole('member')
      fetchUsers()
    }

    setInviting(false)
  }

  async function handleDelete(userId: string, userEmail: string) {
    if (!confirm(`${userEmail} を削除してよろしいですか？`)) return
    setDeletingId(userId)

    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()

    if (!res.ok) {
      alert(data.error || '削除に失敗しました')
    } else {
      fetchUsers()
    }

    setDeletingId(null)
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ユーザー管理</h1>
        <p className="text-slate-500 text-sm mt-1">管理者専用ページ</p>
      </div>

      {/* 招待フォーム */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          メールで招待する
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          招待メールが送信されます。受け取った方がリンクからパスワードを設定してログインできます。
        </p>
        {isLocalhost && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm bg-amber-50 text-amber-700 border border-amber-200">
            ローカル環境からの招待です。招待メールのリンクは本番URL（Vercel）を指します。
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                名前（任意）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="田中 太郎"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="example@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              権限
            </label>
            <div className="flex gap-3">
              {Object.entries(ROLE_LABELS).map(([value, { label, icon }]) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium
                    ${role === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="sr-only"
                  />
                  {icon}
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {role === 'admin' && '全ての機能にアクセスし、ユーザー管理もできます'}
              {role === 'member' && 'プロジェクトの作成・編集・削除ができます'}
              {role === 'viewer' && '閲覧のみ。編集・削除はできません'}
            </p>
          </div>

          {message && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={inviting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
              text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {inviting ? '送信中...' : '招待メールを送る'}
          </button>
        </form>
      </div>

      {/* ユーザー一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            登録ユーザー一覧
            {!loading && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {users.length}人
              </span>
            )}
          </h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700
              hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">読み込み中...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">ユーザーがいません</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                      {u.user_metadata?.name || '(名前未設定)'}
                      <RoleBadge role={u.user_metadata?.role} />
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">
                      作成: {new Date(u.created_at).toLocaleDateString('ja-JP')}
                    </div>
                    {u.last_sign_in_at && (
                      <div className="text-xs text-slate-400">
                        最終ログイン: {new Date(u.last_sign_in_at).toLocaleDateString('ja-JP')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(u.id, u.email || '')}
                    disabled={deletingId === u.id}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50
                      rounded-lg transition-colors disabled:opacity-50"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
