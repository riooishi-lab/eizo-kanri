'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Film, CheckCircle, AlertCircle } from 'lucide-react'

function SetPasswordForm() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    async function verifyInvite() {
      const supabase = createClient()

      // PKCE フロー: token_hash + type=invite でセッションを確立
      if (tokenHash && type === 'invite') {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'invite',
        })
        if (!error && data.user) {
          const metaName = data.user.user_metadata?.name
          if (metaName) setName(metaName)
          setSessionReady(true)
        }
        setChecking(false)
        return
      }

      // すでにセッションがある場合（リロード時など）
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const metaName = session.user.user_metadata?.name
        if (metaName) setName(metaName)
        setSessionReady(true)
      }
      setChecking(false)
    }

    verifyInvite()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      data: { name: name.trim() || undefined },
    })

    if (error) {
      setError('パスワードの設定に失敗しました: ' + error.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/projects'
      }, 2500)
    }

    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">読み込み中...</div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">設定完了</h2>
            <p className="text-slate-500 text-sm">パスワードを設定しました。ダッシュボードに移動します...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">リンクが無効です</h2>
            <p className="text-slate-500 text-sm">
              招待リンクの有効期限が切れているか、すでに使用済みです。
              管理者に再送信を依頼してください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">映像制作案件管理</h1>
          <p className="text-slate-500 mt-1 text-sm">アカウントのパスワードを設定してください</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">パスワード設定</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                名前（任意）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  placeholder:text-slate-400"
                placeholder="田中 太郎"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                パスワード <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  placeholder:text-slate-400"
                placeholder="6文字以上"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                パスワード（確認） <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  placeholder:text-slate-400"
                placeholder="もう一度入力"
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                text-white font-medium py-2.5 px-4 rounded-lg text-sm
                transition-colors duration-150 mt-2"
            >
              {loading ? '設定中...' : 'パスワードを設定してはじめる'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">読み込み中...</div>
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  )
}
