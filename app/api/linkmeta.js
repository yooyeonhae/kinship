import { sendJson } from './_serviceKey.js'

// 붙여넣은 URL의 제목·썸네일을 대신 읽어온다. 키가 필요한 API는 아니지만 프록시가
// 반드시 필요하다 — 브라우저에서 유튜브/쿠팡을 직접 fetch하면 CORS에 막히고,
// 사용자가 매번 제목을 손으로 입력하게 하는 건 "퇴근길에 저장" 이라는 상황에 맞지 않는다.

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']
const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com']

// 쇼핑몰은 종류가 계속 늘어나므로 열거하지 않는다. 아는 곳만 예쁜 이름을 붙이고
// 나머지는 호스트명을 그대로 플랫폼으로 쓴다(마이그레이션 04의 CHECK도 같은 전제다).
const SHOP_NAMES = {
  'kurly.com': '마켓컬리',
  'www.kurly.com': '마켓컬리',
  'coupang.com': '쿠팡',
  'www.coupang.com': '쿠팡',
  'link.coupang.com': '쿠팡',
  'ssg.com': 'SSG',
  'www.ssg.com': 'SSG',
  'emart.ssg.com': '이마트몰',
  'oasis.co.kr': '오아시스',
  'www.oasis.co.kr': '오아시스',
}

function youtubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function metaFromHtml(html, prop) {
  // property="og:title" 과 name="og:title" 이 섞여 쓰이고 속성 순서도 제각각이라
  // content가 앞에 오는 경우까지 두 벌로 찾는다.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeEntities(m[1])
  }
  return null
}

async function fetchHtmlMeta(url) {
  // 봇으로 보이면 빈 셸만 주는 사이트가 많아 일반 브라우저 UA로 요청한다.
  const upstream = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9',
    },
    redirect: 'follow',
  })
  if (!upstream.ok) return {}
  // 상품 페이지는 수 MB짜리도 있는데 필요한 건 <head>뿐이라 앞부분만 읽는다.
  const html = (await upstream.text()).slice(0, 200_000)
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return {
    title: metaFromHtml(html, 'og:title') || (titleTag ? decodeEntities(titleTag[1]) : null),
    thumbnail: metaFromHtml(html, 'og:image'),
  }
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost')
  const raw = (searchParams.get('url') || '').trim()

  let target
  try {
    target = new URL(raw)
  } catch {
    return sendJson(res, 400, { error: '링크 주소를 확인해주세요.' })
  }
  // http(s)만 통과시킨다. file:// 같은 스킴을 그대로 fetch하면 서버 쪽에서 읽힌다.
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return sendJson(res, 400, { error: 'http 또는 https 링크만 저장할 수 있어요.' })
  }

  const host = target.hostname.toLowerCase()

  try {
    if (YOUTUBE_HOSTS.includes(host)) {
      const id = youtubeId(raw)
      // 썸네일은 oEmbed 없이도 주소만으로 얻을 수 있어 제목 조회가 실패해도 카드가 빈 칸이 되지 않는다.
      const thumbnail = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
      const isShorts = target.pathname.startsWith('/shorts/')
      let title = null
      const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(raw)}`)
      if (oembed.ok) {
        const data = await oembed.json()
        title = data.title || null
      }
      return sendJson(res, 200, {
        linkType: 'video',
        platform: isShorts ? '쇼츠' : '유튜브',
        title,
        thumbnail,
      })
    }

    if (INSTAGRAM_HOSTS.includes(host)) {
      // 인스타그램 oEmbed는 앱 토큰을 요구한다. 로그인 없이 얻을 수 있는 건 OG 태그뿐이고
      // 그마저 비공개 계정이면 비어 온다 — 제목이 null로 와도 카드가 저장되게 둔다.
      const meta = await fetchHtmlMeta(raw)
      return sendJson(res, 200, {
        linkType: 'video',
        platform: '인스타',
        title: meta.title || null,
        thumbnail: meta.thumbnail || null,
      })
    }

    const meta = await fetchHtmlMeta(raw)
    return sendJson(res, 200, {
      linkType: 'shopping',
      platform: SHOP_NAMES[host] || host.replace(/^www\./, ''),
      title: meta.title || null,
      thumbnail: meta.thumbnail || null,
    })
  } catch {
    // 상대가 응답하지 않아도 저장 자체는 되어야 한다. 제목 없이 URL만 남는다.
    return sendJson(res, 200, {
      linkType: YOUTUBE_HOSTS.includes(host) || INSTAGRAM_HOSTS.includes(host) ? 'video' : 'shopping',
      platform: SHOP_NAMES[host] || host.replace(/^www\./, ''),
      title: null,
      thumbnail: null,
    })
  }
}
