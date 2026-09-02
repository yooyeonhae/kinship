/**
 * 저녁 메뉴 이미지-레시피 매칭 및 하이브리드 캐싱 서비스
 */

// ── 1. 대표 50선 + 기본 레시피 전체에 대한 정밀 고화질 이미지 매핑 ──
export const SEED_MENU_50 = {
  // [찌개/국물류]
  김치찌개: {
    category: '찌개/국물류',
    search_keyword: 'Kimchi jjigae stew',
    image_url: 'https://images.unsplash.com/photo-1583032015879-66c3ecfa50b9?auto=format&fit=crop&w=800&q=80',
  },
  된장찌개: {
    category: '찌개/국물류',
    search_keyword: 'Doenjang jjigae korean stew',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  },
  '된장찌개 정식': {
    category: '찌개/국물류',
    search_keyword: 'Doenjang jjigae korean stew set',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  },
  순두부찌개: {
    category: '찌개/국물류',
    search_keyword: 'Sundubu jjigae soft tofu stew',
    image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
  },
  부대찌개: {
    category: '찌개/국물류',
    search_keyword: 'Budae jjigae army stew',
    image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80',
  },
  청국장: {
    category: '찌개/국물류',
    search_keyword: 'Cheonggukjang fermented soybean stew',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  },
  삼계탕: {
    category: '찌개/국물류',
    search_keyword: 'Samgyetang korean ginseng chicken',
    image_url: 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80',
  },
  갈비탕: {
    category: '찌개/국물류',
    search_keyword: 'Galbitang short rib soup',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  감자탕: {
    category: '찌개/국물류',
    search_keyword: 'Gamjatang pork bone soup',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  소고기미역국: {
    category: '찌개/국물류',
    search_keyword: 'Korean seaweed soup beef',
    image_url: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?auto=format&fit=crop&w=800&q=80',
  },
  미역국: {
    category: '찌개/국물류',
    search_keyword: 'Korean seaweed soup beef',
    image_url: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?auto=format&fit=crop&w=800&q=80',
  },
  소고기무국: {
    category: '찌개/국물류',
    search_keyword: 'Korean beef radish soup',
    image_url: 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80',
  },
  소고기뭇국: {
    category: '찌개/국물류',
    search_keyword: 'Korean beef radish soup',
    image_url: 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80',
  },
  육개장: {
    category: '찌개/국물류',
    search_keyword: 'Yukgaejang spicy beef soup',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  콩나물국: {
    category: '찌개/국물류',
    search_keyword: 'Kongnamul guk soybean sprout soup',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  콩나물국밥: {
    category: '찌개/국물류',
    search_keyword: 'Kongnamul gukbap bean sprout soup with rice',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  떡국: {
    category: '찌개/국물류',
    search_keyword: 'Tteokguk korean sliced rice cake soup',
    image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80',
  },
  만둣국: {
    category: '찌개/국물류',
    search_keyword: 'Manduguk korean dumpling soup',
    image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80',
  },

  // [고기/구이/볶음류]
  제육볶음: {
    category: '고기/구이/볶음류',
    search_keyword: 'Jeyuk bokkeum spicy pork',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  소불고기: {
    category: '고기/구이/볶음류',
    search_keyword: 'Korean beef bulgogi',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  불고기: {
    category: '고기/구이/볶음류',
    search_keyword: 'Korean beef bulgogi',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  '소불고기 덮밥': {
    category: '고기/구이/볶음류',
    search_keyword: 'Korean beef bulgogi rice bowl',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  돼지갈비찜: {
    category: '고기/구이/볶음류',
    search_keyword: 'Korean braised pork ribs',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  소갈비찜: {
    category: '고기/구이/볶음류',
    search_keyword: 'Galbijjim braised beef short ribs',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  갈비찜: {
    category: '고기/구이/볶음류',
    search_keyword: 'Galbijjim braised beef short ribs',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  삼겹살구이: {
    category: '고기/구이/볶음류',
    search_keyword: 'Samgyeopsal grilled pork belly',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  삼겹살: {
    category: '고기/구이/볶음류',
    search_keyword: 'Samgyeopsal grilled pork belly',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  닭볶음탕: {
    category: '고기/구이/볶음류',
    search_keyword: 'Dakbokkeumtang spicy chicken stew',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  },
  찜닭: {
    category: '고기/구이/볶음류',
    search_keyword: 'Andong jjimdak braised chicken',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  },
  안동찜닭: {
    category: '고기/구이/볶음류',
    search_keyword: 'Andong jjimdak braised chicken',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  },
  훈제오리구이: {
    category: '고기/구이/볶음류',
    search_keyword: 'Smoked duck vegetable stir fry',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  },
  '수육/보쌈': {
    category: '고기/구이/볶음류',
    search_keyword: 'Bossam boiled pork belly korean',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  보쌈: {
    category: '고기/구이/볶음류',
    search_keyword: 'Bossam boiled pork belly korean',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  수육: {
    category: '고기/구이/볶음류',
    search_keyword: 'Bossam boiled pork belly korean',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  족발: {
    category: '고기/구이/볶음류',
    search_keyword: 'Jokbal korean braised pigs trotters',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  떡갈비: {
    category: '고기/구이/볶음류',
    search_keyword: 'Tteokgalbi grilled minced short ribs',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  오삼불고기: {
    category: '고기/구이/볶음류',
    search_keyword: 'Squid and pork belly stir fry',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  춘천닭갈비: {
    category: '고기/구이/볶음류',
    search_keyword: 'Dakgalbi spicy stir fried chicken',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  },
  LA갈비구이: {
    category: '고기/구이/볶음류',
    search_keyword: 'LA galbi grilled marinated ribs',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  두부조림: {
    category: '고기/구이/볶음류',
    search_keyword: 'Dubu jorim braised tofu',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  },

  // [해산물류]
  고등어구이: {
    category: '해산물류',
    search_keyword: 'Grilled mackerel fish',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  },
  '된장국과 생선구이': {
    category: '해산물류',
    search_keyword: 'Grilled fish with soybean soup set',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  },
  갈치조림: {
    category: '해산물류',
    search_keyword: 'Braised hairtail fish korean',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  },
  고등어무조림: {
    category: '해산물류',
    search_keyword: 'Braised mackerel with radish',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  },
  오징어볶음: {
    category: '해산물류',
    search_keyword: 'Ojingeo bokkeum spicy squid',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  낙지볶음: {
    category: '해산물류',
    search_keyword: 'Nakji bokkeum spicy octopus',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },
  조기구이: {
    category: '해산물류',
    search_keyword: 'Grilled yellow croaker',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  },
  해물파전: {
    category: '해산물류',
    search_keyword: 'Haemul pajeon seafood pancake',
    image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80',
  },
  동태찌개: {
    category: '해산물류',
    search_keyword: 'Pollack fish stew korean',
    image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
  },

  // [한그릇/면류/반찬]
  비빔밥: {
    category: '한그릇/면류',
    search_keyword: 'Bibimbap korean mixed rice',
    image_url: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80',
  },
  김치볶음밥: {
    category: '한그릇/면류',
    search_keyword: 'Kimchi fried rice with egg',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  },
  '참치마요 덮밥': {
    category: '한그릇/면류',
    search_keyword: 'Tuna mayo rice bowl',
    image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  },
  카레라이스: {
    category: '한그릇/면류',
    search_keyword: 'Japanese curry rice dish',
    image_url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=800&q=80',
  },
  하이라이스: {
    category: '한그릇/면류',
    search_keyword: 'Hayashi rice hash beef',
    image_url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=800&q=80',
  },
  오므라이스: {
    category: '한그릇/면류',
    search_keyword: 'Omurice omelette rice',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  },
  '계란말이와 밥': {
    category: '한그릇/면류',
    search_keyword: 'Gyeran mari rolled omelette with rice',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  },
  계란말이: {
    category: '한그릇/면류',
    search_keyword: 'Gyeran mari rolled omelette',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  },
  잡채: {
    category: '한그릇/면류',
    search_keyword: 'Japchae korean glass noodles',
    image_url: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80',
  },
  잔치국수: {
    category: '한그릇/면류',
    search_keyword: 'Janchi guksu warm banquet noodles',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  비빔국수: {
    category: '한그릇/면류',
    search_keyword: 'Bibim guksu spicy cold noodles',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  },
  떡볶이: {
    category: '한그릇/면류',
    search_keyword: 'Tteokbokki spicy rice cakes',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  },

  // [양식/퓨전]
  돈가스: {
    category: '양식/퓨전',
    search_keyword: 'Tonkatsu pork cutlet platter',
    image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  },
  돈까스: {
    category: '양식/퓨전',
    search_keyword: 'Tonkatsu pork cutlet platter',
    image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  },
  함박스테이크: {
    category: '양식/퓨전',
    search_keyword: 'Hamburg steak patty egg',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
  토마토파스타: {
    category: '양식/퓨전',
    search_keyword: 'Tomato spaghetti pasta basil',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  },
  크림파스타: {
    category: '양식/퓨전',
    search_keyword: 'Cream sauce fettuccine pasta',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  },
  알리오올리오: {
    category: '양식/퓨전',
    search_keyword: 'Aglio e olio garlic olive oil pasta',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  },
  찹스테이크: {
    category: '양식/퓨전',
    search_keyword: 'Chop steak bite size beef vegetables',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  },
}

// ── 3. 카테고리별 안전한 Fallback 이미지 ──
export const CATEGORY_FALLBACK_MAP = {
  '찌개/국물류': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  '고기/구이/볶음류': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  해산물류: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  '한그릇/면류': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80',
  '양식/퓨전': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  기본: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
}

// 런타임 메모리 캐시
const memoryCache = new Map()

/**
 * 요리 제목을 핵심 키워드로 정규화 (예: '된장찌개 정식' -> '된장찌개')
 */
function normalizeMenuName(title) {
  if (!title) return ''
  return title.trim().replace(/\s+(정식|덮밥|구이|볶음밥|탕|찌개|국밥|와\s*밥)$/, (m) => m)
}

/**
 * [동기식 빠른 반환]
 * 초기 렌더링 시 깜빡임 없이 즉시 사용할 수 있는 이미지 반환
 */
export function getMenuImageSync(menuName) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const raw = menuName.trim()

  if (memoryCache.has(raw)) {
    return memoryCache.get(raw)
  }

  // 1차 Seed 50선 완벽 매칭
  if (SEED_MENU_50[raw]) {
    return SEED_MENU_50[raw].image_url
  }

  // 1-1차 정규화 및 부분 키워드 매칭
  for (const [key, item] of Object.entries(SEED_MENU_50)) {
    if (raw.includes(key) || key.includes(raw)) {
      return item.image_url
    }
  }

  // 3차 Fallback
  if (/찌개|탕|국|청국장|삼계탕/.test(raw)) return CATEGORY_FALLBACK_MAP['찌개/국물류']
  if (/고기|구이|볶음|불고기|갈비|삼겹|닭|오리|보쌈|족발/.test(raw)) return CATEGORY_FALLBACK_MAP['고기/구이/볶음류']
  if (/생선|고등어|갈치|오징어|낙지|조기|해물/.test(raw)) return CATEGORY_FALLBACK_MAP.해산물류
  if (/밥|비빔밥|볶음밥|카레|오므라이스|잡채|국수|면|떡볶이|만두/.test(raw)) return CATEGORY_FALLBACK_MAP['한그릇/면류']
  if (/파스타|스파게티|스테이크|돈가스|돈까스/.test(raw)) return CATEGORY_FALLBACK_MAP['양식/퓨전']

  return CATEGORY_FALLBACK_MAP.기본
}

/**
 * [비동기 하이브리드 파이프라인 서비스 함수]
 */
export async function getMenuImage(menuName, options = {}) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const trimmed = menuName.trim()
  const { supabase, category = '' } = options

  // 메모리 캐시 확인
  if (memoryCache.has(trimmed)) {
    return memoryCache.get(trimmed)
  }

  // 1. 50선 Seed 매핑 확인 (로컬 즉시 확인)
  if (SEED_MENU_50[trimmed]) {
    const url = SEED_MENU_50[trimmed].image_url
    memoryCache.set(trimmed, url)
    return url
  }

  // 2. 키워드 부분 매칭 즉시 확인
  for (const [key, item] of Object.entries(SEED_MENU_50)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      const url = item.image_url
      memoryCache.set(trimmed, url)
      return url
    }
  }

  // 3. Supabase DB menu_items 테이블 캐시 조회
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('image_url, source_type')
        .eq('name', trimmed)
        .maybeSingle()

      if (!error && data?.image_url) {
        memoryCache.set(trimmed, data.image_url)
        return data.image_url
      }
    } catch (err) {
      console.warn('DB menu_items 조회 중 에러:', err.message)
    }
  }

  // 4. 미등록 메뉴 시 /api/menu-image 호출
  try {
    const res = await fetch(
      `/api/menu-image?name=${encodeURIComponent(trimmed)}&category=${encodeURIComponent(category)}`
    )
    if (res.ok) {
      const data = await res.json()
      if (data.imageUrl) {
        memoryCache.set(trimmed, data.imageUrl)
        return data.imageUrl
      }
    }
  } catch (err) {
    console.warn('외부 이미지 검색 API 호출 실패:', err)
  }

  // 5. Fallback URL 반환
  const fallbackUrl = getMenuImageSync(trimmed)
  memoryCache.set(trimmed, fallbackUrl)
  return fallbackUrl
}
