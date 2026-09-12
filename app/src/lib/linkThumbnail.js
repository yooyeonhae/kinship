import { getMenuImageSync } from './menuService'

/**
 * 퇴근길 저장함 (영상/장보기) 썸네일 및 홈피 대표 이미지 처리 모듈
 */

// YouTube Video ID 추출기 (쇼츠, 임베드, 모바일, 공유링크 등 모든 규격 지원)
export function getYouTubeVideoId(url) {
  if (!url) return null
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

// 장보기 관련 홈피 대표 메인 사진 이미지 (Unsplash 검증 고화질 푸드마켓/신선식자재)
export const SHOPPING_STORE_IMAGES = {
  kurly: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80', // 마켓컬리 감성 신선마켓
  coupang: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80', // 쿠팡 로켓프레시 마켓
  ssg: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80', // SSG 신선푸드
  emart: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80', // 이마트몰
  oasis: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80', // 오아시스 친환경 유기농
  naver: 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=600&q=80', // 네이버 장보기/동네시장
  homeplus: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  lottemart: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80',
  baemin: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  default: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80', // 기본 마켓
}

// 요리 영상/크리에이터 대표 메인 사진 이미지
export const CREATOR_FOOD_IMAGES = {
  chef: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80', // 셰프 요리/김대석 셰프
  lunchbox: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', // 런치/직장인 도시락 (kimjinsun_lunch)
  korean_stew: '/images/doenjang_jjigae.jpg', // 한국 전통 찌개 요리
  youtube_cook: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80', // 유튜브 요리 영상
  instagram_food: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', // 인스타 푸드/레시피
}

/**
 * 링크의 플랫폼 키를 감지합니다.
 */
export function detectPlatformKey(link = {}) {
  const url = (link.url || '').toLowerCase()
  const platform = (link.platform || '').toLowerCase()

  if (url.includes('youtube.com') || url.includes('youtu.be') || platform.includes('유튜브') || platform.includes('쇼츠')) {
    return 'youtube'
  }
  if (url.includes('instagram.com') || platform.includes('인스타')) {
    return 'instagram'
  }
  if (url.includes('kurly.com') || platform.includes('컬리')) {
    return 'kurly'
  }
  if (url.includes('coupang.com') || platform.includes('쿠팡')) {
    return 'coupang'
  }
  if (url.includes('emart') || platform.includes('이마트')) {
    return 'emart'
  }
  if (url.includes('ssg.com') || platform.includes('ssg')) {
    return 'ssg'
  }
  if (url.includes('oasis.co.kr') || platform.includes('오아시스')) {
    return 'oasis'
  }
  if (url.includes('shopping.naver.com') || url.includes('smartstore.naver.com') || platform.includes('네이버')) {
    return 'naver'
  }
  if (url.includes('homeplus') || platform.includes('홈플러스')) {
    return 'homeplus'
  }
  if (url.includes('lottemart') || url.includes('lotteon') || platform.includes('롯데')) {
    return 'lottemart'
  }
  if (url.includes('baemin') || platform.includes('b마트')) {
    return 'baemin'
  }
  return link.link_type === 'shopping' ? 'shopping' : 'video'
}

/**
 * 링크 정보를 분석하여 최적의 썸네일 이미지를 반환합니다.
 * (기존 저장된 링크의 thumbnail_url이 null이거나 로드 실패 시에도 완벽한 메인 사진 반환)
 */
export function resolveLinkThumbnail(link = {}) {
  // 1. 이미 유효한 고화질 썸네일 URL이 있는 경우 우선 검토
  if (link.thumbnail_url && typeof link.thumbnail_url === 'string' && link.thumbnail_url.startsWith('http')) {
    return link.thumbnail_url
  }

  const url = (link.url || '').trim()
  const title = (link.title || '').trim()
  const pKey = detectPlatformKey(link)

  // 2. 유튜브 링크 분석
  if (pKey === 'youtube') {
    const ytId = getYouTubeVideoId(url)
    if (ytId) {
      return `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`
    }
    // 유튜브 채널/크리에이터 URL (예: 김대석 셰프 요리)
    if (/김대석|셰프|요리|쿡|식당|집밥|마스터/i.test(title) || /김대석|chef/i.test(url)) {
      return CREATOR_FOOD_IMAGES.chef
    }
    // 음식 키워드 매칭 (찌개, 볶음밥, 고기 등)
    const foodImg = getMenuImageSync(title)
    if (foodImg && !foodImg.includes('placeholder')) {
      return foodImg
    }
    return CREATOR_FOOD_IMAGES.youtube_cook
  }

  // 3. 인스타그램 링크 분석
  if (pKey === 'instagram') {
    // 직장인 런치/도시락 계정 (예: kimjinsun_lunch)
    if (/lunch|도시락|점심|식단|밀프랩|반찬|김진선/i.test(title) || /lunch|kimjinsun/i.test(url)) {
      return CREATOR_FOOD_IMAGES.lunchbox
    }
    const foodImg = getMenuImageSync(title)
    if (foodImg && !foodImg.includes('placeholder')) {
      return foodImg
    }
    return CREATOR_FOOD_IMAGES.instagram_food
  }

  // 4. 장보기 (쇼핑몰) 링크 분석
  if (link.link_type === 'shopping' || ['kurly', 'coupang', 'ssg', 'emart', 'oasis', 'naver', 'homeplus', 'lottemart', 'baemin', 'shopping'].includes(pKey)) {
    // 특정 식재료명 포함 시 해당 신선 식재료 사진 매칭
    if (/소고기|돼지고기|삼겹살|한우/.test(title)) return '/images/samgyeopsal.jpg'
    if (/계란|달걀|치즈/.test(title)) return 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80'
    if (/두부|콩/.test(title)) return '/images/tofu_jorim.jpg'

    // 해당 쇼핑몰 공식 대표 홈피 메인 마켓 사진
    if (SHOPPING_STORE_IMAGES[pKey]) {
      return SHOPPING_STORE_IMAGES[pKey]
    }
    return SHOPPING_STORE_IMAGES.default
  }

  // 5. 기본 요리 영상 폴백
  return CREATOR_FOOD_IMAGES.youtube_cook
}

/**
 * 썸네일 우측 하단/좌측 상단에 띄울 브랜드 뱃지 스타일 정보
 */
export function getPlatformBadge(link = {}) {
  const pKey = detectPlatformKey(link)
  const isVideo = link.link_type === 'video' || ['youtube', 'instagram'].includes(pKey)

  switch (pKey) {
    case 'youtube':
      return {
        label: link.platform || '유튜브',
        badgeBg: 'bg-[#FF0000]',
        badgeText: 'text-white',
        icon: 'ph-fill ph-youtube-logo',
      }
    case 'instagram':
      return {
        label: link.platform || '인스타',
        badgeBg: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-instagram-logo',
      }
    case 'kurly':
      return {
        label: '마켓컬리',
        badgeBg: 'bg-[#5f0080]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-shopping-bag',
      }
    case 'coupang':
      return {
        label: '쿠팡',
        badgeBg: 'bg-[#C00000]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-lightning',
      }
    case 'ssg':
      return {
        label: 'SSG',
        badgeBg: 'bg-[#FF5000]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-storefront',
      }
    case 'emart':
      return {
        label: '이마트몰',
        badgeBg: 'bg-[#FFB800]',
        badgeText: 'text-black',
        icon: 'ph-bold ph-shopping-cart',
      }
    case 'oasis':
      return {
        label: '오아시스',
        badgeBg: 'bg-[#28A745]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-leaf',
      }
    case 'naver':
      return {
        label: '네이버',
        badgeBg: 'bg-[#03C75A]',
        badgeText: 'text-white',
        icon: 'ph-bold ph-storefront',
      }
    default:
      return {
        label: link.platform || (isVideo ? '영상' : '장보기'),
        badgeBg: isVideo ? 'bg-primary' : 'bg-secondary',
        badgeText: 'text-white',
        icon: isVideo ? 'ph-bold ph-play' : 'ph-bold ph-shopping-cart',
      }
  }
}
