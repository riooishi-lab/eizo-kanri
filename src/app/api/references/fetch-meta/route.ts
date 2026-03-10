import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── タグ自動推定キーワードマップ ─────────────────────────────────────────
const TAG_RULES: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /採用|リクルート|recruit/i,         tag: '採用' },
  { pattern: /PR|プロモーション|promotion/i,     tag: 'PR' },
  { pattern: /インタビュー|interview/i,          tag: 'インタビュー' },
  { pattern: /ダイジェスト|まとめ|digest/i,      tag: 'ダイジェスト' },
  { pattern: /観光|地域|tourism/i,               tag: '観光' },
  { pattern: /密着|1日密着/i,                   tag: '密着' },
  { pattern: /座談会/i,                          tag: '座談会' },
]

function inferTags(text: string): string[] {
  const matched: string[] = []
  for (const { pattern, tag } of TAG_RULES) {
    if (pattern.test(text) && !matched.includes(tag)) {
      matched.push(tag)
    }
  }
  return matched
}

function isYouTube(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/.test(url)
}

function extractMeta(html: string, key: string): string | null {
  // <meta property="og:xxx" content="..."> または content="..." property="og:xxx"> 両方に対応
  const re = new RegExp(
    `<meta[^>]+(?:property=["']${key}["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']${key}["'])`,
    'i'
  )
  const m = html.match(re)
  return m ? (m[1] ?? m[2] ?? null) : null
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim() : null
}

/**
 * POST /api/references/fetch-meta
 * { url: string } を受け取り、タイトル・サムネイル・タグを返す
 */
export async function POST(request: NextRequest) {
  // 認証チェック
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json({ error: 'url_required' }, { status: 400 })
  }

  // URL 形式チェック
  try { new URL(url) } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  try {
    // ── YouTube ──────────────────────────────────────────────────────────
    if (isYouTube(url)) {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const res = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json() as {
          title?: string
          thumbnail_url?: string
          author_name?: string
        }
        const title = data.title ?? null
        const tags  = inferTags([title ?? ''].join(' '))
        return NextResponse.json({
          title,
          thumbnail_url: data.thumbnail_url ?? null,
          description:   null,
          company_name:  data.author_name ?? null,
          case_content:  null,
          orientation:   'landscape',
          tags,
        })
      }
    }

    // ── 汎用 OGP ─────────────────────────────────────────────────────────
    const res = await fetch(url, {
      signal:  AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EizoKanriBot/1.0)' },
    })

    if (!res.ok) {
      return NextResponse.json({ title: null, thumbnail_url: null, description: null, orientation: 'landscape', tags: [] })
    }

    // HTML は最大 200KB のみ読む（大きすぎるページ対策）
    const reader  = res.body?.getReader()
    if (!reader) {
      return NextResponse.json({ title: null, thumbnail_url: null, description: null, orientation: 'landscape', tags: [] })
    }
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalBytes += value.length
      if (totalBytes >= 200_000) break
    }
    reader.cancel()
    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(chunks.reduce<number[]>((acc, c) => [...acc, ...c], []))
    )

    const ogTitle       = extractMeta(html, 'og:title')
    const ogImage       = extractMeta(html, 'og:image')
    const ogDescription = extractMeta(html, 'og:description')
    const ogSiteName    = extractMeta(html, 'og:site_name')
    const title         = ogTitle ?? extractTitle(html) ?? null

    const tags = inferTags([title ?? '', ogDescription ?? ''].join(' '))

    return NextResponse.json({
      title,
      thumbnail_url: ogImage ?? null,
      description:   ogDescription ?? null,
      company_name:  ogSiteName ?? null,
      case_content:  ogDescription ?? null,
      orientation:   'landscape',
      tags,
    })
  } catch (err) {
    console.error('[fetch-meta] error:', err)
    return NextResponse.json({ title: null, thumbnail_url: null, description: null, orientation: 'landscape', tags: [] })
  }
}
