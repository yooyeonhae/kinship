// 전 세계 유명 랜드마크 데이터 및 세계여행 퍼즐킹 유틸리티
// 각 대륙별 대표 랜드마크의 정확한 실물 사진(정사각 크롭), 국가, 도시, 국기 이모지, 역사/문화 상식 수록

export const WORLD_LANDMARKS = [
  {
    id: 'seoul_ntower',
    name: 'N서울타워 & 남산',
    country: '대한민국',
    city: '서울',
    flag: '🇰🇷',
    continent: '아시아',
    imageUrl: '/images/landmarks/seoul_ntower.jpg',
    trivia: '남산 꼭대기에 우뚝 솟아 서울 도심 전체를 360도로 한눈에 조망할 수 있는 대한민국의 대표 랜드마크예요. 팔각정과 사랑의 자물쇠 명소로도 유명해요!',
  },
  {
    id: 'paris_eiffel',
    name: '에펠탑 (Eiffel Tower)',
    country: '프랑스',
    city: '파리',
    flag: '🇫🇷',
    continent: '유럽',
    imageUrl: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '1889년 파리 만국 박람회를 기념해 건축된 330m 높이의 상징적인 철탑이에요. 밤이 되면 2만 개의 황금빛 전구가 반짝이며 환상적인 야경을 선사해요!',
  },
  {
    id: 'rome_colosseum',
    name: '콜로세움 (Colosseum)',
    country: '이탈리아',
    city: '로마',
    flag: '🇮🇹',
    continent: '유럽',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '고대 로마 시대에 검투사 경기와 연극이 열렸던 거대한 원형 경기장이에요. 무려 5만 명 이상의 관객이 동시에 관람할 수 있었답니다!',
  },
  {
    id: 'santorini_oia',
    name: '산토리니 이아마을',
    country: '그리스',
    city: '산토리니',
    flag: '🇬🇷',
    continent: '유럽',
    imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '푸른 에게해 바다와 눈부신 하얀 절벽 가옥, 파란 돔 지붕 교회가 그림처럼 어우러진 섬이에요. 세계에서 가장 아름다운 일몰을 자랑한답니다!',
  },
  {
    id: 'ny_statue_liberty',
    name: '자유의 여신상 (Statue of Liberty)',
    country: '미국',
    city: '뉴욕',
    flag: '🇺🇸',
    continent: '북아메리카',
    imageUrl: 'https://images.unsplash.com/photo-1503572327579-b5c6afe5c5c5?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '프랑스가 미국의 독립 100주년을 축하하며 선물한 거대한 동상이에요. 오른손에는 자유를 비추는 횃불을, 왼손에는 1776년 7월 4일이 적힌 독립선언서를 들고 있어요!',
  },
  {
    id: 'tokyo_fuji',
    name: '후지산 (Mount Fuji)',
    country: '일본',
    city: '시즈오카/야마나시',
    flag: '🇯🇵',
    continent: '아시아',
    imageUrl: 'https://images.unsplash.com/photo-1578637387939-43c525550085?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '해발 3,776m로 일본에서 가장 높은 산이자 신성한 영산이에요. 눈 덮인 만년설 봉우리가 빚어내는 완벽한 원추형 실루엣이 세계적인 감탄을 자아내요!',
  },
  {
    id: 'london_bigben',
    name: '빅벤과 국회의사당',
    country: '영국',
    city: '런던',
    flag: '🇬🇧',
    continent: '유럽',
    imageUrl: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '템스강변의 런던 웨스트민스터 궁전에 위치한 유서 깊은 시계탑이에요. 15분마다 울리는 묵직하고 맑은 종소리가 런던 시민들에게 시간을 알려줘요!',
  },
  {
    id: 'sydney_operahouse',
    name: '시드니 오페라하우스',
    country: '호주',
    city: '시드니',
    flag: '🇦🇺',
    continent: '오세아니아',
    imageUrl: 'https://images.unsplash.com/photo-1624138784614-87fd1b6528f8?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '푸른 바다 위에 떠 있는 하얀 돛단배 또는 조개껍데기를 연상시키는 혁신적인 디자인으로 20세기 최고의 현대 건축 걸작으로 꼽혀요!',
  },
  {
    id: 'cairo_pyramids',
    name: '기자의 대피라미드와 스핑크스',
    country: '이집트',
    city: '카이로',
    flag: '🇪🇬',
    continent: '아프리카',
    imageUrl: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '고대 세계 7대 불가사의 중 지금까지 유일하게 남아 있는 건축물이에요. 수백만 개의 거대한 돌 블록을 정교하게 쌓아 올려 파라오의 영원한 안식을 염원했어요!',
  },
  {
    id: 'agra_tajmahal',
    name: '타지마할 (Taj Mahal)',
    country: '인도',
    city: '아그라',
    flag: '🇮🇳',
    continent: '아시아',
    imageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '무굴 제국의 황제 샤 자한이 세상을 떠난 아내를 추모하기 위해 순백의 대리석으로 22년에 걸쳐 지은 완벽한 좌우 대칭의 무덤 궁전이에요!',
  },
  {
    id: 'swiss_alps',
    name: '스위스 알프스 라우터브루넨',
    country: '스위스',
    city: '라우터브루넨 / 융프라우',
    flag: '🇨🇭',
    continent: '유럽',
    imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '빙하가 깎아 만든 웅장한 수직 절벽과 72개의 폭포, 알프스 만년설 봉우리가 동화처럼 어우러진 스위스의 대표적인 휴양 마을이에요!',
  },
  {
    id: 'peru_machupicchu',
    name: '마추픽추 (Machu Picchu)',
    country: '페루',
    city: '쿠스코',
    flag: '🇵🇪',
    continent: '남아메리카',
    imageUrl: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?auto=format&fit=crop&w=800&h=800&q=80',
    trivia: '안데스산맥 2,430m 고지에 세워진 잉카 제국의 공중도시예요. 구름 위에 떠 있는 듯 신비로운 자태를 뽐내는 세계 7대 불가사의 중 하나랍니다!',
  },
]

export function getRandomLandmark() {
  const idx = Math.floor(Math.random() * WORLD_LANDMARKS.length)
  return WORLD_LANDMARKS[idx]
}

export function getLandmarkById(id) {
  return WORLD_LANDMARKS.find((l) => l.id === id) || WORLD_LANDMARKS[0]
}

/**
 * 3x3 (9개) 퍼즐 조각 셔플 함수
 * 완전히 풀린 상태(0개 오답)가 나오지 않도록 보장
 */
export function shuffleTiles(gridSize = 3) {
  const total = gridSize * gridSize
  let tiles = Array.from({ length: total }, (_, i) => i)

  let attempts = 0
  while (attempts < 20) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
    }
    // 제자리에 있는 타일이 너무 많지 않은지 체크 (최대 2개 이하만 제자리)
    const correctCount = tiles.filter((val, idx) => val === idx).length
    if (correctCount <= 2) {
      break
    }
    attempts++
  }

  return tiles
}

/**
 * 진행도 계산 유틸
 */
export function calcProgress(tiles) {
  if (!tiles || !tiles.length) return { correctCount: 0, total: 9, percentage: 0, isComplete: false }
  const correctCount = tiles.filter((val, idx) => val === idx).length
  const total = tiles.length
  const percentage = Math.round((correctCount / total) * 100)
  return {
    correctCount,
    total,
    percentage,
    isComplete: correctCount === total,
  }
}
