// 끝말잇기 한국어 명사 사전 및 인공지능(AI) 로봇 전략 데이터베이스

// 두음법칙 및 편의 변이형 매핑
export const DEUM_MAP = {
  // ㄹ -> ㄴ, ㅇ, 기타 모음
  '라': ['라', '나'], '락': ['락', '낙'], '란': ['란', '난'], '랄': ['랄', '날'], '람': ['람', '남'],
  '랍': ['랍', '납'], '랑': ['랑', '낭'], '래': ['래', '내'], '랭': ['랭', '냉'], '략': ['략', '약'],
  '량': ['량', '양'], '려': ['려', '여'], '력': ['력', '역'], '련': ['련', '연'], '렬': ['렬', '열'],
  '렴': ['렴', '염'], '렵': ['렵', '엽'], '령': ['령', '영'], '례': ['례', '예'], '로': ['로', '노'],
  '록': ['록', '녹'], '론': ['론', '논'], '롱': ['롱', '농'], '뢰': ['뢰', '뇌'], '료': ['료', '요'],
  '룡': ['룡', '용'], '루': ['루', '누'], '류': ['류', '유'], '륙': ['륙', '육'], '륜': ['륜', '윤'],
  '률': ['률', '율'], '륭': ['륭', '융'], '륵': ['륵', '늑', '윽'], '름': ['름', '늠', '음'], '릉': ['릉', '능', '응'],
  '리': ['리', '이', '니'], '린': ['린', '인', '닌'], '림': ['림', '임', '님'], '립': ['립', '입', '닙'],
  '릇': ['릇', '늣', '읏'], '릎': ['릎', '늪', '읍'], '릊': ['릊', '늦', '엊', '읒'],
  '녀': ['녀', '여'], '년': ['년', '연'], '념': ['념', '염'], '녕': ['녕', '영'], '녜': ['녜', '예'],
  '뇨': ['뇨', '요'], '뉴': ['뉴', '유'], '니': ['니', '이'], '닉': ['닉', '익'], '닙': ['닙', '입'],
  '늠': ['늠', '음'], '능': ['능', '응'], '늑': ['늑', '윽'], '늪': ['늪', '읍'],
}

import { OFFLINE_NOUNS } from './wordChainNouns.js'

// 138,000+ 이상의 실생활 2~5글자 한국어 명사 데이터
export const RAW_KOREAN_NOUNS = OFFLINE_NOUNS.split(' ')

// 내장 사전 집합
export const DICTIONARY_SET = new Set(RAW_KOREAN_NOUNS)

// 한방 단어(상대방이 이을 수 없는 단어) 목록 및 방어 데이터 분석
export const ATTACK_WORDS = [
  '라듐', '나트륨', '칼륨', '마그네슘', '칼슘', '헬륨', '리튬', '베릴륨', '스칸듐', '바나듐',
  '크로뮴', '세슘', '루비듐', '스트론튬', '이트륨', '지르코늄', '나이오븀', '몰리브데넘', '테크네튬',
  '루테늄', '로듐', '팔라듐', '카드뮴', '인듐', '안티모니', '텔루륨', '바륨', '란타넘', '세륨',
  '프라세오디뮴', '네오디뮴', '프로메튬', '사마륨', '유로퓸', '가돌리늄', '터븀', '디스프로슘',
  '홀뮴', '어븀', '툴륨', '이터븀', '루테튬', '하프늄', '탄탈럼', '텅스텐', '레늄', '오스뮴',
  '이리듐', '백금', '탈륨', '비스무트', '폴로늄', '아스타틴', '라돈', '프랑슘', '악티늄', '토륨',
  '프로트악티늄', '우라늄', '넵투늄', '플루토늄', '아메리슘', '퀴륨', '버클륨', '캘리포늄', '아인슈타이늄',
  '페르뮴', '멘델레븀', '노벨륨', '로렌슘', '시보귬', '마이트너륨', '다름슈타튬', '뢴트게늄', '코페르니슘',
  '오가네손', '기쁨', '슬픔', '아픔', '노을빛', '여우비', '가을녘', '새벽녘', '해질녘', '들녘', '밥그릇',
  '국그릇', '물그릇', '옹기그릇', '질그릇', '사기그릇', '눈웃음', '코웃음', '헛웃음', '비웃음', '선무당',
  '사기꾼', '장사꾼', '사냥꾼', '낚시꾼', '나무꾼', '소리꾼', '익살꾼', '구경꾼', '일꾼', '노름꾼',
  '술주정뱅이', '욕심쟁이', '멋쟁이', '골칫거리', '볼거리', '먹거리', '이야깃거리', '웃음거리', '걱정거리'
]

// 사전에 한방 단어들 병합
ATTACK_WORDS.forEach(w => DICTIONARY_SET.add(w))

// 시작 글자별 단어 인덱스
export const WORDS_BY_START = {}
export const WINNING_WORDS_BY_START = {}
export const SAFE_WORDS_BY_START = {}

// 두음법칙 변이형 반환
export function getDeumVariants(ch) {
  if (!ch) return []
  return DEUM_MAP[ch] || [ch]
}

// 사전 인덱싱 빌드
export function buildWordIndexes() {
  const allWords = Array.from(DICTIONARY_SET)

  allWords.forEach(word => {
    const firstChar = word[0]
    const variants = getDeumVariants(firstChar)
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      if (!WORDS_BY_START[v]) WORDS_BY_START[v] = []
      WORDS_BY_START[v].push(word)
    }
  })

  // 한방 단어 및 안전 단어 분류
  allWords.forEach(word => {
    const firstChar = word[0]
    const lastChar = word[word.length - 1]
    const variants = getDeumVariants(firstChar)
    const nextVariants = getDeumVariants(lastChar)
    const hasNextWords = nextVariants.some(v => WORDS_BY_START[v] && WORDS_BY_START[v].length > 0)

    if (!hasNextWords) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        if (!WINNING_WORDS_BY_START[v]) WINNING_WORDS_BY_START[v] = []
        WINNING_WORDS_BY_START[v].push(word)
      }
    } else {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        if (!SAFE_WORDS_BY_START[v]) SAFE_WORDS_BY_START[v] = []
        SAFE_WORDS_BY_START[v].push(word)
      }
    }
  })
}

// 최초 1회 인덱싱
buildWordIndexes()

// AI 로봇 난이도별 단어 선택
export function getBotWord(startChar, difficulty = 'normal', usedSet = new Set()) {
  const variants = getDeumVariants(startChar)
  let candidates = []

  // 1. 아기 로봇 (Easy): 쉬운 2~3글자 일상 단어 위주, 한방 단어 절대 안 씀, 15% 확률로 단어 못 찾고 항복
  if (difficulty === 'easy') {
    if (Math.random() < 0.15 && usedSet.size >= 4) return null // 적당히 이어지면 항복
    for (const v of variants) {
      const list = (SAFE_WORDS_BY_START[v] || WORDS_BY_START[v] || []).filter(w => !usedSet.has(w) && w.length <= 3)
      candidates.push(...list)
    }
    if (candidates.length === 0) {
      for (const v of variants) {
        const list = (WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
        candidates.push(...list)
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  }

  // 2. 똘똘한 로봇 (Normal): 안전한 단어로 안정적으로 방어하며 균형잡힌 플레이
  if (difficulty === 'normal') {
    for (const v of variants) {
      const safe = (SAFE_WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
      if (safe.length > 0) candidates.push(...safe)
    }
    if (candidates.length === 0) {
      for (const v of variants) {
        const list = (WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
        candidates.push(...list)
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  }

  // 3. 끝판왕 로봇 (Hard/Boss):
  // 1순위: 한방 단어(즉사 공격), 2순위: 안전 단어 방어, 3순위: 일반 단어
  if (difficulty === 'boss' || difficulty === 'hard') {
    for (const v of variants) {
      const winning = (WINNING_WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
      if (winning.length > 0) {
        return winning[Math.floor(Math.random() * winning.length)]
      }
    }
    for (const v of variants) {
      const safe = (SAFE_WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
      if (safe.length > 0) candidates.push(...safe)
    }
    if (candidates.length === 0) {
      for (const v of variants) {
        const list = (WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
        candidates.push(...list)
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  }

  return null
}

// 힌트 단어 가져오기
export function getHintWord(startChar, usedSet = new Set()) {
  const variants = getDeumVariants(startChar)
  for (const v of variants) {
    const list = (SAFE_WORDS_BY_START[v] || WORDS_BY_START[v] || []).filter(w => !usedSet.has(w))
    if (list.length > 0) {
      return list[Math.floor(Math.random() * list.length)]
    }
  }
  return null
}

// 로봇의 익살스럽고 실감나는 대사 목록
export const BOT_QUOTES = {
  intro: [
    '내가 먼저 시작할게! 잘 받아쳐 봐 😎',
    '끝말잇기라면 내가 우리 동네 챔피언이지! 🤖',
    '자, 준비되셨나요? 첫 단어 갑니다! 🚀',
  ],
  attack: [
    '후후, 이건 절대 못 이을걸? 외통수다! ⚡',
    '끝판왕의 필살 단어 공격! 받아쳐 보시죠! 🔥',
    '이 단어로 끝말잇기 종료입니다! 👑',
    '빈틈 발견! 강력한 한방 단어 투척! 🎯',
  ],
  defend: [
    '제법이군! 하지만 내 방어는 완벽하지. 🛡️',
    '좋은 공격이었어! 난 이렇게 받는다! ✨',
    '후훗, 침착하게 받아쳐 주마! 💡',
    '탄탄한 수비! 다음엔 어떻게 나올 테냐? 🧐',
  ],
  defeat: [
    '크윽... 내가 지다니! 다음엔 이길 테다! 💥',
    '인정합니다... 당신은 진정한 끝말잇기 고수! 🏆',
    '로봇의 두뇌가 과열됐어요... 졌다! 🤯',
  ],
  win: [
    '하하하! 끝판왕 로봇의 승리입니다! 👑',
    '더 수련하고 오시길 바랍니다! 후후 😎',
  ],
}
