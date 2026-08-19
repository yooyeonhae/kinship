export async function fetchWeather(region) {
  const query = region ? `?region=${encodeURIComponent(region)}` : ''
  const res = await fetch(`/api/weather${query}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error || '날씨를 불러오지 못했어요.')
  }
  return body
}

// screens/js/weather.js의 규칙을 그대로 옮긴 것 — 지정복 위에 뭘 더 챙길지만 정한다.
export function buildRecommendation(outfitType, weather) {
  let extra = null
  if (weather.condition?.startsWith('rain')) {
    extra = { name: '우비', note: '비가 올 수 있어서 우산보다 우비가 편해요.' }
  } else if (weather.tempC !== null && weather.tempC <= 10) {
    extra = { name: '겉옷', note: '쌀쌀하니 겉옷 하나만 챙기면 충분해요.' }
  } else if (weather.tempC !== null && weather.tempC >= 28) {
    extra = { name: '얇은 여벌옷', note: '땀이 많이 날 수 있어서 얇은 여벌옷을 챙겨주세요.' }
  }
  return {
    main: outfitType,
    extra,
    title: extra ? `${outfitType} + ${extra.name}` : outfitType,
    note: extra ? extra.note : '오늘은 별다른 준비물 없이 지정복만 챙기면 충분해요.',
  }
}
