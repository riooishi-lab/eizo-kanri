'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Film, CheckCircle, AlertCircle } from 'lucide-react'

export default function SetPasswordPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    // URLハッシュのエラーを先にチェック（Supabaseがエラー時にハッシュで返す）
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.slice(1))
      const errorCode = params.get('error_code')
      if (errorCode === 'otp_expired') {
        setLinkError('招待リンクの有効期限が切れています。管理者に再送信を依頼してください。')
      } else {
        setLinkError('招待リンクが無効です。管理者に再送信を依頼してください。')
      }
      setChecking(false)
      return
    }

    // ハッシュにトークンがある場合は長めに待つ（15秒）、ない場合は短く（3秒）
    const hasToken = hash.includes('access_token=')
    const timeoutMs = hasToken ? 15000 : 3000

    const supabase = createClient()

    const handleSession = (session: { user: { user_metadata?: { name?: string } } } | null) => {
      if (!session) return
      const metaName = session.user.user_metadata?.name
      if (metaName) setName(metaName)
      setSessionReady(true)
      setChecking(false)
    }

    // ハッシュに access_token がある場合、Supabase クライアントが自動処理して認証イベントを発火する
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
        handleSession(session)
      }
    })

    // すでにセッションがある場合（リロード時など）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session)
      }
    })

    // フォールバック：トークンがない場合は短く、ある場合は長めに待って無効と判定
    const timeout = setTimeout(() => {
      setChecking(false)
    }, timeoutMs)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setSubmitError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setSubmitError('パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)
    setSubmitError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      data: { name: name.trim() || undefined },
    })

    if (error) {
      setSubmitError('パスワードの設定に失敗しました: ' + error.message)
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

  if (linkError || !sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">リンクが無効です</h2>
            <p className="text-slate-500 text-sm">
              {linkError || '招待リンクの有効期限が切れているか、すでに使用済みです。管理者に再送信を依頼してください。'}
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

            {submitError && (
              <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
                {submitError}
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
