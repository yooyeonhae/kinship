// TourAPI areaCode ↔ 화면에 쓰는 지역명. 노어 서비스는 지역명도 러시아어로 내려주므로
// 목록 필터·표시용 한국어 라벨은 이 표에서 가져온다.
export const AREA_CODES = {
  서울: 1, 인천: 2, 대전: 3, 대구: 4, 광주: 5, 부산: 6, 울산: 7, 세종: 8,
  경기: 31, 강원: 32, 충북: 33, 충남: 34, 경북: 35, 경남: 36, 전북: 37, 전남: 38, 제주: 39,
}

export const AREA_NAMES = Object.fromEntries(Object.entries(AREA_CODES).map(([k, v]) => [v, k]))

// searchFestival2는 areacode를 빈 문자열로 내려준다. 축제의 지역은 주소에서 유도해야 한다.
// 강원·전북·제주는 특별자치도로 개편되어 옛 표기와 새 표기가 섞여 있다.
const ADDR_PREFIX = [
  ['서울', ['서울']], ['부산', ['부산']], ['대구', ['대구']], ['인천', ['인천']],
  ['광주', ['광주광역시']], ['대전', ['대전']], ['울산', ['울산']], ['세종', ['세종']],
  ['경기', ['경기']], ['강원', ['강원']], ['충북', ['충청북도', '충북']],
  ['충남', ['충청남도', '충남']], ['전북', ['전라북도', '전북']], ['전남', ['전라남도', '전남']],
  ['경북', ['경상북도', '경북']], ['경남', ['경상남도', '경남']], ['제주', ['제주']],
]

export function regionFromAddr(addr) {
  if (!addr) return null
  const head = addr.trim()
  for (const [label, prefixes] of ADDR_PREFIX) {
    if (prefixes.some((p) => head.startsWith(p))) return label
  }
  return null
}
