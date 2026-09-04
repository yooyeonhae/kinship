/**
 * 저녁 메뉴 이미지-레시피 매칭 및 하이브리드 캐싱 서비스
 *
 * [2026-09-03] 브라우저에서 각 URL을 직접 확인하여 잘못된 이미지를 전면 교체함.
 * 기존 URL 다수가 아보카도 국수·케밥·아보카도 토스트 등 완전히 틀린 음식을 가리키고 있었음.
 */

// ── 테마별 검증된 고화질 음식 사진 아카이브 (브라우저 직접 검증 완료) ──
export const CURATED_FOOD_PHOTOS = {
  // 1. 닭요리 / 백숙 / 삼계탕 (누룽지 백숙 포함) — 삼계탕 뚝배기 ✅
  chicken_soup: 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80',
  // 2. 뚝배기 찌개 / 찌개류 (김치찌개, 된장찌개, 순두부찌개, 청국장 등) — 김치찌개 ✅
  korean_stew: 'https://images.unsplash.com/photo-1760228865341-675704c22a5b?auto=format&fit=crop&w=800&q=80',
  // 3. 따뜻한 떡국 / 만둣국 / 사골국 — 백탁 국물 ✅
  tteokguk_soup: 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80',
  // 4. 잔치국수 / 칼국수 / 면류 — 소면 국물 ✅
  korean_noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  // 5. 볶음밥 / 김치볶음밥 / 덮밥 — 김치볶음밥 달걀 프라이 ✅
  fried_rice: 'https://images.unsplash.com/photo-1600688654899-379ec76aca42?auto=format&fit=crop&w=800&q=80',
  // 6. 불고기 / 제육볶음 / 삼겹살 / 고기구이 — 한국식 BBQ 그릴 ✅
  korean_meat: 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80',
  // 7. 생선구이 / 조림 / 해물 — 노릇한 고등어구이 & 뚝배기 된장찌개 백반 (네이버 검증 완료) ✅
  grilled_fish: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg',
  // 8. 비빔밥 — 비빔밥 그릇 ✅
  bibimbap: 'https://images.unsplash.com/photo-1718777791239-c473e9ce7376?auto=format&fit=crop&w=800&q=80',
  // 9. 돈까스 / 튀김 — 돈카츠 ✅
  tonkatsu: 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80',
  // 10. 파스타 / 스파게티 — 페투치네 ✅
  pasta: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  // 11. 계란말이 / 반찬 — 고소한 모짜렐라 치즈 계란말이 (네이버 검증 완료) ✅
  egg_roll: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg',
  // 12. 카레라이스 — 일본식 카레 ✅
  curry_rice: 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80',
  // 13. 떡볶이 / 분식 — 찌개류 (붉은 소스) ✅
  tteokbokki: 'https://images.unsplash.com/photo-1760228865341-675704c22a5b?auto=format&fit=crop&w=800&q=80',
  // 14. 오므라이스 — 노란 계란옷에 케첩 지그재그 집밥 오므라이스 (네이버 검증 완료) ✅
  omurice: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG',
}

// ── 1. 대표 50선 및 자주 쓰이는 메뉴 사전 매핑 ──
export const SEED_MENU_50 = {
  // [찌개/국물류]
  김치찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  된장찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  '된장찌개 정식': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  순두부찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  부대찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  청국장: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  동태찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  삼계탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  '누룽지 백숙': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  누룽지백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  닭백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  닭곰탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  갈비탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  감자탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  소고기미역국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  미역국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  소고기무국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  소고기뭇국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  육개장: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  콩나물국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  콩나물국밥: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  떡국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },
  떡만둣국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },
  만둣국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },

  // [고기/구이/볶음류]
  제육볶음: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  소불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  '소불고기 덮밥': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  돼지갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  소갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  삼겹살구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  삼겹살: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  닭볶음탕: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  찜닭: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  안동찜닭: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  훈제오리구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  '수육/보쌈': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  보쌈: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  수육: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  족발: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  떡갈비: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  오삼불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  춘천닭갈비: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  LA갈비구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  두부조림: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_stew },

  // [해산물류]
  고등어구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  '된장국과 생선구이': { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  생선구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  갈치조림: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  고등어무조림: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  오징어볶음: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  낙지볶음: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  조기구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  해물파전: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.egg_roll },

  // [한그릇/면류]
  비빔밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  김치볶음밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  볶음밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  '참치마요 덮밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  카레라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.curry_rice },
  하이라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.curry_rice },
  오므라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.omurice },
  '계란말이와 밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.egg_roll },
  계란말이: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.egg_roll },
  잡채: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  잔치국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  비빔국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  떡볶이: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tteokbokki },

  // [양식/퓨전]
  돈가스: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.tonkatsu },
  돈까스: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.tonkatsu },
  함박스테이크: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  토마토파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  크림파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  알리오올리오: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  스파게티: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  찹스테이크: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.korean_meat },
}

// ── 3. 카테고리별 Fallback 이미지 ──
export const CATEGORY_FALLBACK_MAP = {
  '찌개/국물류': CURATED_FOOD_PHOTOS.korean_stew,
  '고기/구이/볶음류': CURATED_FOOD_PHOTOS.korean_meat,
  해산물류: CURATED_FOOD_PHOTOS.grilled_fish,
  '한그릇/면류': CURATED_FOOD_PHOTOS.fried_rice,
  '양식/퓨전': CURATED_FOOD_PHOTOS.pasta,
  기본: CURATED_FOOD_PHOTOS.korean_stew,
}

// 런타임 메모리 캐시
const memoryCache = new Map()

/**
 * 키워드 기반 스마트 이미지 매핑 (누룽지 백숙, 떡국, 잔치국수 등 즉시 해결)
 */
function matchFoodPhotoByKeyword(title) {
  if (!title) return null
  const t = title.trim().toLowerCase()

  // 1. 닭/백숙/삼계탕 (누룽지 백숙 포함)
  if (/백숙|누룽지|삼계탕|닭백숙|닭곰탕|닭한마리/.test(t)) {
    return CURATED_FOOD_PHOTOS.chicken_soup
  }

  // 2. 떡국 / 만둣국
  if (/떡국|떡만두|만둣국|만두국|사골떡/.test(t)) {
    return CURATED_FOOD_PHOTOS.tteokguk_soup
  }

  // 3. 국수 / 잔치국수 / 칼국수
  if (/잔치국수|국수|소면|칼국수|우동|짬뽕|짜장/.test(t)) {
    return CURATED_FOOD_PHOTOS.korean_noodle
  }

  // 3.5 생선구이 / 생선구이 정식 (된장찌개 포함 시 생선구이 우선)
  if (/된장국과\s*생선구이|생선구이|고등어구이|갈치구이|조기구이/.test(t)) {
    return CURATED_FOOD_PHOTOS.grilled_fish
  }

  // 4. 찌개 / 탕 / 뚝배기
  if (/찌개|된장|김치찌개|순두부|부대찌개|청국장|전골|탕/.test(t)) {
    return CURATED_FOOD_PHOTOS.korean_stew
  }

  // 5. 볶음밥 / 오므라이스 / 비빔밥 / 덮밥 / 카레
  if (/오므라이스/.test(t)) {
    return CURATED_FOOD_PHOTOS.omurice
  }
  if (/김치볶음밥|볶음밥|참치마요/.test(t)) {
    return CURATED_FOOD_PHOTOS.fried_rice
  }
  if (/비빔밥|잡채/.test(t)) {
    return CURATED_FOOD_PHOTOS.bibimbap
  }
  if (/카레|하이라이스/.test(t)) {
    return CURATED_FOOD_PHOTOS.curry_rice
  }

  // 6. 고기 / 불고기 / 제육 / 갈비
  if (/불고기|제육|삼겹|갈비|고기|보쌈|수육|족발|닭볶음|찜닭|스테이크|닭갈비/.test(t)) {
    return CURATED_FOOD_PHOTOS.korean_meat
  }

  // 7. 생선 / 해물
  if (/생선|고등어|갈치|조기|오징어|낙지|해물/.test(t)) {
    return CURATED_FOOD_PHOTOS.grilled_fish
  }

  // 8. 파스타 / 돈까스
  if (/파스타|스파게티|알리오/.test(t)) {
    return CURATED_FOOD_PHOTOS.pasta
  }
  if (/돈가스|돈까스/.test(t)) {
    return CURATED_FOOD_PHOTOS.tonkatsu
  }

  // 9. 계란 / 달걀
  if (/계란|달걀|오믈렛/.test(t)) {
    return CURATED_FOOD_PHOTOS.egg_roll
  }

  return null
}

/**
 * [동기식 빠른 반환]
 */
export function getMenuImageSync(menuName) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const raw = menuName.trim()

  if (memoryCache.has(raw)) {
    return memoryCache.get(raw)
  }

  // 1차 완벽 매칭
  if (SEED_MENU_50[raw]) {
    return SEED_MENU_50[raw].image_url
  }

  // 2차 정밀 키워드 스마트 매칭 (누룽지 백숙, 떡국, 잔치국수 등 100% 처리)
  const matched = matchFoodPhotoByKeyword(raw)
  if (matched) {
    return matched
  }

  // 3차 부분 문자열 검색
  for (const [key, item] of Object.entries(SEED_MENU_50)) {
    if (raw.includes(key) || key.includes(raw)) {
      return item.image_url
    }
  }

  return CATEGORY_FALLBACK_MAP.기본
}

/**
 * [비동기 하이브리드 파이프라인 서비스 함수]
 */
export async function getMenuImage(menuName, options = {}) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const trimmed = menuName.trim()
  const { supabase, category = '' } = options

  if (memoryCache.has(trimmed)) {
    return memoryCache.get(trimmed)
  }

  // 1. 키워드/사전 매핑에서 즉시 정확한 이미지 획득
  const syncImage = getMenuImageSync(trimmed)
  if (syncImage && syncImage !== CATEGORY_FALLBACK_MAP.기본) {
    memoryCache.set(trimmed, syncImage)
    return syncImage
  }

  // 2. Supabase DB 캐시 확인
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('image_url')
        .eq('name', trimmed)
        .maybeSingle()

      if (!error && data?.image_url) {
        memoryCache.set(trimmed, data.image_url)
        return data.image_url
      }
    } catch (err) {
      console.warn('DB menu_items 조회 에러:', err.message)
    }
  }

  // 3. Fallback
  memoryCache.set(trimmed, syncImage)
  return syncImage
}
