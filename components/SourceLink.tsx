/**
 * 公开来源链接：详情页此前直接显示完整 URL，又长又难读。
 * 这里改成「域名 · 末级路径」的可读标签，完整 URL 仍保留在 href 与 title 中。
 */
export function sourceLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const segments = decodeURIComponent(parsed.pathname).split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    const hint = last.replace(/\.(html?|php|aspx?|jsp)$/i, '').slice(0, 28)
    return hint ? `${host} · ${hint}` : host
  } catch {
    return url.replace(/^https?:\/\//, '').slice(0, 48)
  }
}

export function SourceLink({ url }: { url: string }) {
  return (
    <a href={url} title={url} target="_blank" rel="nofollow noopener noreferrer">
      {sourceLabel(url)}
    </a>
  )
}
