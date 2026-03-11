'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    // 招待・パスワードリセットのトークンがルートURLに届いた場合、set-passwordページへ転送
    if (hash.includes('access_token=') || hash.includes('error=')) {
      router.replace('/auth/set-password' + hash)
      return
    }
    router.replace('/projects')
  }, [router])

  return null
}
