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

// 쇼핑몰 대표 메인 사진 이미지 (쿠팡, 마켓컬리, SSG, 이마트 등 봇 차단 시 고화질 홈피 대표 사진 제공)
const SHOP_HERO_IMAGES = {
  'kurly.com': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  'www.kurly.com': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  'coupang.com': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  'www.coupang.com': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  'link.coupang.com': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  'm.coupang.com': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  'ssg.com': 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80',
  'www.ssg.com': 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80',
  'emart.ssg.com': 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80',
  'oasis.co.kr': 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80',
  'www.oasis.co.kr': 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80',
  'shopping.naver.com': 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=600&q=80',
  'smartstore.naver.com': 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=600&q=80',
}

const DEFAULT_SHOP_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
const DEFAULT_CHEF_IMAGE = 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80'
const DEFAULT_LUNCHBOX_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
const DEFAULT_INSTAGRAM_IMAGE = 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80'

function youtubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0]?.split('?')[0] || null
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2]?.split('?')[0] || null
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2]?.split('?')[0] || null
    if (u.pathname.startsWith('/live/')) return u.pathname.split('/')[2]?.split('?')[0] || null
    if (u.pathname.startsWith('/v/')) return u.pathname.split('/')[2]?.split('?')[0] || null
    return u.searchParams.get('v') || null
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
  try {
    const upstream = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept-language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    })
    if (!upstream.ok) return {}
    const html = (await upstream.text()).slice(0, 200_000)
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return {
      title: metaFromHtml(html, 'og:title') || (titleTag ? decodeEntities(titleTag[1]) : null),
      thumbnail: metaFromHtml(html, 'og:image'),
    }
  } catch {
    return {}
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
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return sendJson(res, 400, { error: 'http 또는 https 링크만 저장할 수 있어요.' })
  }

  const host = target.hostname.toLowerCase()

  try {
    // ── 1. 유튜브 / 쇼츠 ──
    if (YOUTUBE_HOSTS.includes(host)) {
      const id = youtubeId(raw)
      const isShorts = target.pathname.startsWith('/shorts/')
      let title = null
      let thumbnail = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null

      try {
        const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(raw)}`)
        if (oembed.ok) {
          const data = await oembed.json()
          title = data.title || null
          if (data.thumbnail_url) {
            thumbnail = data.thumbnail_url
          }
        }
      } catch {
        // ignore
      }

      // 채널 URL(@김대석셰프요리 등)이거나 id가 없는 경우 HTML 메타 확인
      if (!thumbnail || !title) {
        const meta = await fetchHtmlMeta(raw)
        if (!title) title = meta.title || null
        if (!thumbnail && meta.thumbnail) thumbnail = meta.thumbnail
      }

      // 셰프 요리/요리 채널 키워드 매칭
      if (!thumbnail) {
        thumbnail = /김대석|셰프|요리|쿡/i.test(title || raw) ? DEFAULT_CHEF_IMAGE : DEFAULT_CHEF_IMAGE
      }

      return sendJson(res, 200, {
        linkType: 'video',
        platform: isShorts ? '쇼츠' : '유튜브',
        title: title || (target.pathname.includes('@') ? decodeURIComponent(target.pathname.replace(/^\/@?/, '')) : null),
        thumbnail,
      })
    }

    // ── 2. 인스타그램 (릴스, 포스트, 프로필 계정) ──
    if (INSTAGRAM_HOSTS.includes(host)) {
      let title = null
      let thumbnail = null

      const isPostOrReel = target.pathname.startsWith('/p/') || target.pathname.startsWith('/reel/')
      const cleanPath = target.pathname.replace(/^\/|\/$/g, '')
      const parts = cleanPath.split('/')
      const username = !isPostOrReel && parts[0] ? parts[0] : ''

      if (isPostOrReel && parts[1]) {
        const code = parts[1]
        try {
          // 인스타 임베드 페이지에서 대표 썸네일 이미지 추출
          const embedRes = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
            headers: {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
              'accept-language': 'ko-KR,ko;q=0.9',
            },
          })
          if (embedRes.ok) {
            const html = await embedRes.text()
            const imgMatch = html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/i) ||
                             html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*EmbeddedMediaImage[^"]*"/i)
            if (imgMatch) {
              thumbnail = decodeEntities(imgMatch[1])
            }
            const capMatch = html.match(/<div class="Caption">([^<]+)<\/div>/i)
            if (capMatch) {
              title = decodeEntities(capMatch[1]).slice(0, 80)
            }
          }
        } catch {
          // ignore
        }
      }

      if (!thumbnail || !title) {
        const meta = await fetchHtmlMeta(raw)
        if (!title) title = meta.title || username || null
        if (!thumbnail) thumbnail = meta.thumbnail || null
      }

      // 도시락/런치(kimjinsun_lunch 등) 계정이거나 음식인 경우 감성 도시락/요리 이미지 매칭
      if (!thumbnail) {
        if (/lunch|도시락|점심|kimjinsun/i.test(raw) || /lunch|도시락|점심|kimjinsun/i.test(title || '')) {
          thumbnail = DEFAULT_LUNCHBOX_IMAGE
        } else {
          thumbnail = DEFAULT_INSTAGRAM_IMAGE
        }
      }

      return sendJson(res, 200, {
        linkType: 'video',
        platform: '인스타',
        title: title || (username ? `@${username}` : null),
        thumbnail,
      })
    }

    // ── 3. 장보기 (쿠팡, 마켓컬리, SSG, 이마트, 오아시스 등) ──
    const meta = await fetchHtmlMeta(raw)
    let thumbnail = meta.thumbnail || null

    // 봇 차단으로 썸네일이 null인 경우 해당 쇼핑몰 공식 대표 홈피 메인 마켓 사진 제공
    if (!thumbnail) {
      thumbnail = SHOP_HERO_IMAGES[host] || DEFAULT_SHOP_IMAGE
    }

    return sendJson(res, 200, {
      linkType: 'shopping',
      platform: SHOP_NAMES[host] || host.replace(/^www\./, ''),
      title: meta.title || null,
      thumbnail,
    })
  } catch {
    const isVideo = YOUTUBE_HOSTS.includes(host) || INSTAGRAM_HOSTS.includes(host)
    return sendJson(res, 200, {
      linkType: isVideo ? 'video' : 'shopping',
      platform: SHOP_NAMES[host] || host.replace(/^www\./, ''),
      title: null,
      thumbnail: isVideo ? DEFAULT_CHEF_IMAGE : (SHOP_HERO_IMAGES[host] || DEFAULT_SHOP_IMAGE),
    })
  }
}
