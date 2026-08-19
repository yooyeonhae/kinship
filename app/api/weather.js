import { REGION_COORD, DEFAULT_COORD } from './_grid.js'
import { sendJson, fetchJson } from './_serviceKey.js'

const BASE = 'https://api.openweathermap.org/data/2.5'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// OpenWeatherMap condition code(weather[0].id) → 화면 아이콘·분류.
// buildRecommendation()이 condition의 'rain' 접두사로 우비를 판단하므로 접두사를 지킨다.
function classify(id) {
  if (id >= 200 && id < 300) return { condition: 'rain-thunder', icon: 'ph-cloud-lightning' }
  if (id >= 300 && id < 400) return { condition: 'rain-drizzle', icon: 'ph-cloud-rain' }
  if (id >= 500 && id < 600) return { condition: 'rain-shower', icon: 'ph-cloud-rain' }
  // 눈은 우비가 아니라 겉옷 쪽이 맞아서 rain 접두사를 붙이지 않는다.
  if (id >= 600 && id < 700) return { condition: 'snow', icon: 'ph-snowflake' }
  if (id >= 700 && id < 800) return { condition: 'atmosphere', icon: 'ph-cloud-fog' }
  if (id === 800) return { condition: 'sky-1', icon: 'ph-sun' }
  if (id === 801 || id === 802) return { condition: 'sky-3', icon: 'ph-cloud-sun' }
  return { condition: 'sky-4', icon: 'ph-cloud' }
}

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

function kstDateKey(unixSeconds) {
  const d = new Date(unixSeconds * 1000 + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

export default async function handler(req, res) {
  const apiKey = process.env.WEATHER_API_KEY
  if (!apiKey) {
    return sendJson(res, 503, { error: 'WEATHER_API_KEY가 설정되지 않았습니다.' })
  }

  const url = new URL(req.url, 'http://localhost')
  const region = url.searchParams.get('region')
  const [lat, lon] = REGION_COORD[region] || DEFAULT_COORD
  const query = `lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`

  // 현재 실황과 3시간 예보를 함께 쓴다. 오늘 최저·최고와 강수확률은 예보에만 있다.
  const [current, forecast] = await Promise.all([
    fetchJson(`${BASE}/weather?${query}`),
    fetchJson(`${BASE}/forecast?${query}`),
  ])

  if (!current.ok) {
    return sendJson(res, 502, { error: '날씨 응답을 해석하지 못했습니다.', detail: current.body })
  }
  if (Number(current.data?.cod) !== 200) {
    const message = current.data?.message || '알 수 없는 오류'
    // 401은 대부분 신규 키 활성화 대기(최대 2시간)다.
    const hint = Number(current.data?.cod) === 401 ? ' (키가 아직 활성화되지 않았을 수 있어요)' : ''
    return sendJson(res, 502, { error: `OpenWeatherMap 오류: ${message}${hint}` })
  }

  const now = kstNow()
  const weatherId = current.data.weather?.[0]?.id ?? 800
  const { condition, icon } = classify(weatherId)

  let minTempC = null
  let maxTempC = null
  let rainProb = null
  if (forecast.ok && Array.isArray(forecast.data?.list)) {
    const todayKey = kstDateKey(Math.floor(Date.now() / 1000))
    const today = forecast.data.list.filter((row) => kstDateKey(row.dt) === todayKey)
    // 자정 직전이면 오늘 남은 예보가 없을 수 있어 그때는 전체 구간으로 떨어뜨린다.
    const scope = today.length ? today : forecast.data.list.slice(0, 8)
    const mins = scope.map((r) => r.main?.temp_min).filter((v) => typeof v === 'number')
    const maxs = scope.map((r) => r.main?.temp_max).filter((v) => typeof v === 'number')
    const pops = scope.map((r) => r.pop).filter((v) => typeof v === 'number')
    if (mins.length) minTempC = Math.round(Math.min(...mins))
    if (maxs.length) maxTempC = Math.round(Math.max(...maxs))
    if (pops.length) rainProb = Math.round(Math.max(...pops) * 100)
  }

  res.setHeader('cache-control', 's-maxage=1800, stale-while-revalidate=3600')
  return sendJson(res, 200, {
    dateLabel: `${now.getUTCMonth() + 1}월 ${now.getUTCDate()}일 ${DAY_NAMES[now.getUTCDay()]}요일`,
    tempC: Math.round(current.data.main.temp),
    minTempC,
    maxTempC,
    rainProb,
    condition,
    icon,
    description: current.data.weather?.[0]?.description || '—',
    region: region || '서울',
    source: 'openweathermap',
  })
}
