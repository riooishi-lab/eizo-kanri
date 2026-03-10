'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/projects', label: '案件管理',      icon: '📋', match: /^\/(projects|dashboard)/ },
  { href: '/references', label: 'リファレンス', icon: '🎬', match: /^\/references/ },
  { href: '/memos',  label: 'メモ',            icon: '📝', match: /^\/memos/ },
  { href: '/reports', label: 'レポート',        icon: '📊', match: /^\/reports/ },
]

export default function Header() {
  const router  = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-gray-900 h-14 sticky top-0 z-40 border-b border-gray-800 flex">
      {/* 左：ロゴ */}
      <div className="flex items-center px-5 w-52 shrink-0">
        <span className="text-white font-semibold text-sm tracking-wide">🎬 映像制作管理</span>
      </div>

      {/* 中央：タブナビゲーション */}
      <nav className="flex-1 flex items-stretch justify-center">
        {TABS.map(tab => {
          const isActive = tab.match.test(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-5 text-sm font-medium transition-colors border-b-2
                ${isActive
                  ? 'bg-gray-700 text-white border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* 右：ログアウト */}
      <div className="flex items-center px-5 w-52 shrink-0 justify-end">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white
            hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </header>
  )
}
