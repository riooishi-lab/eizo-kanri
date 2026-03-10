import Header from '@/components/Header'

// 認証が必要なページは常に動的レンダリング（プリレンダリング不要）
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  )
}
