'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Film } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // クライアントはアクション実行時に初期化（ビルド時のSSRを回避）
    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage({ type: 'error', text: 'メールアドレスまたはパスワードが正しくありません。' })
      } else {
        window.location.href = '/projects'
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({
          type: 'success',
          text: '確認メールを送信しました。メールボックスをご確認ください。',
        })
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">映像制作案件管理</h1>
          <p className="text-slate-500 mt-1 text-sm">Video Production Manager</p>
        </div>

        {/* カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  placeholder:text-slate-400"
                placeholder="example@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  placeholder:text-slate-400"
                placeholder="6文字以上"
                minLength={6}
              />
            </div>

            {message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                text-white font-medium py-2.5 px-4 rounded-lg text-sm
                transition-colors duration-150 mt-2"
            >
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setMessage(null)
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              {mode === 'login'
                ? 'アカウントをお持ちでない方はこちら'
                : 'すでにアカウントをお持ちの方はこちら'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
