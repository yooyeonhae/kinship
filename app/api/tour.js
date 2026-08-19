import { AREA_CODES, AREA_NAMES, regionFromAddr } from './_area.js'
import { encodeServiceKey, sendJson, fetchJson } from './_serviceKey.js'

// 한국관광공사 관광정보서비스_GW. 노어(RusService2)는 응답은 정상이지만 등록 콘텐츠가
// 0건이라 국문을 기본으로 쓴다. 다른 언어판으로 바꿀 때만 TOUR_API_SERVICE를 지정한다.
const SERVICE = process.env.TOUR_API_SERVICE || 'KorService2'
const BASE = `https://apis.data.go.kr/B551011/${SERVICE}`

// 화면의 type(festival/sight/play)에 대응하는 contentTypeId.
const TYPE_BY_CONTENT = { 15: 'festival', 12: 'sight', 14: 'play', 28: 'sight', 25: 'sight' }

const COMMON = {
  MobileOS: 'ETC',
  MobileApp: 'ourfamily',
  _type: 'json',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayYmd() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`
}

// eventStartDate는 '그 날짜 이후에 시작하는' 행사만 걸러낸다. 오늘로 주면 이미 진행
// 중인 축제가 통째로 빠지므로, 넉넉히 과거부터 받아온 뒤 종료일로 직접 거른다.
function searchFromYmd() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 - 180 * 24 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`
}

function formatEventDate(start, end) {
  if (!start) return '상시'
  const fmt = (v) => `${Number(v.slice(4, 6))}월 ${Number(v.slice(6, 8))}일`
  if (!end || end === start) return fmt(start)
  return `${fmt(start)} ~ ${fmt(end)}`
}

function normalize(item) {
  const contentTypeId = Number(item.contenttypeid)
  return {
    id: `tour-${item.contentid}`,
    title: item.title,
    // 학생 대상 여부를 API가 구분해주지 않는다. 화면 필터를 살리려면 값이 필요해서
    // 전부 'family'로 두고, 사용자가 직접 추가한 항목만 student를 가질 수 있게 한다.
    category: 'family',
    type: TYPE_BY_CONTENT[contentTypeId] || 'sight',
    region: AREA_NAMES[Number(item.areacode)] || regionFromAddr(item.addr1) || '',
    date: formatEventDate(item.eventstartdate, item.eventenddate),
    location: item.addr1 || '',
    image: item.firstimage || '',
    startDate: item.eventstartdate || '',
    endDate: item.eventenddate || '',
    source: 'tourapi',
  }
}

export default async function handler(req, res) {
  const serviceKey = process.env.TOUR_API_KEY
  if (!serviceKey) {
    return sendJson(res, 503, { error: 'TOUR_API_KEY가 설정되지 않았습니다.' })
  }

  const url = new URL(req.url, 'http://localhost')
  const regionLabel = url.searchParams.get('region') || '서울'
  const areaCode = AREA_CODES[regionLabel]
  if (!areaCode) {
    return sendJson(res, 400, { error: `지원하지 않는 지역입니다: ${regionLabel}` })
  }
  const contentTypeId = url.searchParams.get('contentTypeId') || '15'

  const isFestival = contentTypeId === '15'
  const limit = Number(url.searchParams.get('numOfRows') || '12')
  const params = new URLSearchParams({
    ...COMMON,
    pageNo: '1',
    // 축제는 지역·종료일 필터를 직접 걸어야 해서 전국을 넉넉히 받아온 뒤 잘라낸다.
    numOfRows: isFestival ? '500' : String(limit),
    arrange: isFestival ? 'A' : 'O',
  })
  if (isFestival) {
    // areaCode를 붙이면 결과가 거의 비어버린다. searchFestival2는 areacode를 채워
    // 내려주지 않아 지역 매칭이 주소 기반으로만 가능하다.
    params.set('eventStartDate', searchFromYmd())
  } else {
    params.set('areaCode', String(areaCode))
    params.set('contentTypeId', contentTypeId)
  }

  const endpoint = isFestival ? 'searchFestival2' : 'areaBasedList2'
  const target = `${BASE}/${endpoint}?serviceKey=${encodeServiceKey(serviceKey)}&${params}`

  const result = await fetchJson(target)
  if (!result.ok) {
    return sendJson(res, 502, { error: '관광공사 응답을 해석하지 못했습니다.', detail: result.body })
  }

  const header = result.data?.response?.header
  if (header && header.resultCode !== '0000' && header.resultCode !== '00') {
    return sendJson(res, 502, { error: `관광공사 오류: ${header.resultMsg}`, code: header.resultCode })
  }

  // 결과가 0건이면 items가 배열이 아니라 빈 문자열로 내려온다.
  const raw = result.data?.response?.body?.items?.item
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []

  let activities = items.map(normalize)
  let totalInRegion = activities.length
  if (isFestival) {
    const today = todayYmd()
    const live = activities
      .filter((a) => !a.endDate || a.endDate >= today)
      .filter((a) => a.region === regionLabel)
      .sort((x, y) => (x.startDate || '').localeCompare(y.startDate || ''))
    totalInRegion = live.length
    activities = live.slice(0, limit)
  } else {
    activities = activities.map((a) => (a.region ? a : { ...a, region: regionLabel }))
  }

  res.setHeader('cache-control', 's-maxage=3600, stale-while-revalidate=86400')
  return sendJson(res, 200, { region: regionLabel, service: SERVICE, total: totalInRegion, activities })
}
