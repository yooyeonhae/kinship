export async function fetchNews(query, limit = 4) {
  const params = new URLSearchParams({ query, limit: String(limit) })
  const res = await fetch(`/api/news?${params}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error || '뉴스를 불러오지 못했어요.')
  }
  return body.items
}
