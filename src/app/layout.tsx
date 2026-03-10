import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '映像制作案件管理',
  description: '映像制作会社向け案件管理システム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  )
}
