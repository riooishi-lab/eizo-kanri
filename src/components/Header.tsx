'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isAdmin } from '@/lib/admin'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/projects', label: '案件管理',      icon: '📋', match: /^\/(projects|dashboard)/ },
  { href: '/references', label: 'リファレンス', icon: '🎬', match: /^\/references/ },
  { href: '/memos',  label: 'メモ',            icon: '📝', match: /^\/memos/ },
  { href: '/reports', label: 'レポート',        icon: '📊', match: /^\/reports/ },
]

const ADMIN_MENUS = [
  { href: '/admin/import', label: '案件一括登録' },
  { href: '/admin/users',  label: 'ユーザー管理' },
]

export default function Header() {
  const router   = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const adminUser = isAdmin(userEmail)
  const isAdminPath = pathname.startsWith('/admin')

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

      {/* 右：管理者メニュー＋ログアウト */}
      <div className="flex items-center px-5 w-56 shrink-0 justify-end gap-2">
        {adminUser && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAdminOpen(v => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors
                ${isAdminPath
                  ? 'text-white bg-gray-700'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <Settings className="w-4 h-4" />
              管理
              <ChevronDown className={`w-3 h-3 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
            </button>

            {adminOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                {ADMIN_MENUS.map(menu => (
                  <Link
                    key={menu.href}
                    href={menu.href}
                    onClick={() => setAdminOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors
                      ${pathname === menu.href
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {menu.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

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
