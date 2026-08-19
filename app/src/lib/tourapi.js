export const TOUR_REGIONS = ['서울', '인천', '대전', '대구', '광주', '부산', '울산', '세종', '경기', '강원', '충북', '충남', '경북', '경남', '전북', '전남', '제주']

export const TOUR_CONTENT_TYPES = [
  { id: '15', label: '축제·행사' },
  { id: '12', label: '관광지' },
  { id: '14', label: '문화시설' },
]

export async function fetchTourActivities({ region = '서울', contentTypeId = '15' } = {}) {
  const query = new URLSearchParams({ region, contentTypeId })
  const res = await fetch(`/api/tour?${query}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error || '관광 정보를 불러오지 못했어요.')
  }
  return body.activities
}
