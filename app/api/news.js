import { sendJson } from './_serviceKey.js'

const ENDPOINT = 'https://openapi.naver.com/v1/search/news.json'

// 자녀도 같은 앱에서 이 화면을 연다. 뉴스는 무엇이 올라올지 통제할 수 없어
// 강력범죄·사망 사건 기사는 제목 기준으로 걸러낸다. 완벽한 필터는 아니고,
// 가족용 화면에 명백히 부적절한 것만 쳐내는 최소 안전장치다.
const BLOCKED = [
  '사망', '숨진', '숨져', '숨졌', '시신', '학대', '살해', '살인', '피살',
  '성폭행', '성추행', '성범죄', '음란', '자살', '극단적 선택', '흉기', '납치', '마약',
]

function stripTags(text) {
  return text.replace(/<[^>]+>/g, '')
}

// 네이버는 title/description에 <b> 태그와 HTML 엔티티를 섞어 내려준다.
function decode(text) {
  return stripTags(text)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function sourceFromLink(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function formatDate(pubDate) {
  const t = Date.parse(pubDate)
  if (Number.isNaN(t)) return ''
  const kst = new Date(t + 9 * 60 * 60 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}

// 같은 사건을 여러 매체가 쓰면 제목이 거의 같지만 앞머리가 달라서
// ('[속보] 코스피…' / '코스피, 장 초반…') 접두사 비교로는 안 걸린다.
// 단어 집합의 겹침 비율로 판단한다.
function tokenize(title) {
  return new Set(
    title
      .split(/[^가-힣a-zA-Z0-9]+/)
      .filter((w) => w.length > 1)
  )
}

function isDuplicate(tokens, accepted) {
  for (const prev of accepted) {
    let shared = 0
    for (const t of tokens) if (prev.has(t)) shared += 1
    const smaller = Math.min(tokens.size, prev.size)
    if (smaller > 0 && shared / smaller >= 0.6) return true
  }
  return false
}

export default async function handler(req, res) {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return sendJson(res, 503, { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다.' })
  }

  const url = new URL(req.url, 'http://localhost')
  const query = (url.searchParams.get('query') || '').trim()
  if (!query) {
    return sendJson(res, 400, { error: '검색어가 없습니다.' })
  }
  const limit = Math.min(Number(url.searchParams.get('limit') || '4'), 10)

  // 최신순(sort=date)은 검색어가 본문에 스치기만 한 기사까지 올라온다.
  // 관련도순이 헤드라인 목적에는 훨씬 낫다. 필터링으로 줄어들 것을 감안해 넉넉히 받는다.
  const params = new URLSearchParams({ query, display: '30', sort: 'sim' })

  const upstream = await fetch(`${ENDPOINT}?${params}`, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  })
  const text = await upstream.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return sendJson(res, 502, { error: '네이버 응답을 해석하지 못했습니다.', detail: text.slice(0, 300) })
  }

  if (!upstream.ok) {
    return sendJson(res, 502, { error: `네이버 오류: ${data.errorMessage || upstream.status}` })
  }

  const accepted = []
  const items = []
  for (const raw of data.items || []) {
    const title = decode(raw.title || '')
    if (!title) continue
    if (BLOCKED.some((word) => title.includes(word))) continue
    const tokens = tokenize(title)
    if (isDuplicate(tokens, accepted)) continue
    accepted.push(tokens)
    items.push({
      id: raw.link,
      title,
      source: sourceFromLink(raw.originallink || raw.link),
      date: formatDate(raw.pubDate),
      link: raw.link,
    })
    if (items.length >= limit) break
  }

  res.setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600')
  return sendJson(res, 200, { query, items })
}
