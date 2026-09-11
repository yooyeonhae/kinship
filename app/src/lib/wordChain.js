// 끝말잇기 규칙 판정, 두음법칙, 다인원 턴 순환 및 자모 조합기 (IME)

import { DICTIONARY_SET, DEUM_MAP } from './wordChainData.js'

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

const VOWEL_COMBINE = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' }
const VOWEL_BASE = { 'ㅘ': 'ㅗ', 'ㅙ': 'ㅗ', 'ㅚ': 'ㅗ', 'ㅝ': 'ㅜ', 'ㅞ': 'ㅜ', 'ㅟ': 'ㅜ', 'ㅢ': 'ㅡ' }
const JONG_COMBINE = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' }
const JONG_SPLIT = { 'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'] }

export function isHangulSyllable(ch) {
  if (!ch) return false
  const code = ch.codePointAt(0)
  return code >= HANGUL_START && code <= HANGUL_END
}

export function isHangulWord(word) {
  return word.length > 0 && [...word].every(isHangulSyllable)
}

export function decompose(ch) {
  if (!ch || !isHangulSyllable(ch)) return null
  const i = ch.codePointAt(0) - HANGUL_START
  return { cho: Math.floor(i / 588), jung: Math.floor((i % 588) / 28), jong: i % 28 }
}

export function composeIdx(cho, jung, jong) {
  return String.fromCharCode(HANGUL_START + cho * 588 + jung * 28 + jong)
}

// 두음법칙으로 허용되는 시작 글자 목록
export function allowedHeads(ch) {
  if (!ch || !isHangulSyllable(ch)) return []
  if (DEUM_MAP[ch]) return DEUM_MAP[ch]

  const heads = new Set([ch])
  const d = decompose(ch)
  if (!d) return [ch]
  const { cho, jung, jong } = d

  // ㄹ(5) 초성
  if (cho === 5) {
    if ([2, 6, 7, 12, 17, 20].includes(jung)) {
      // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ -> ㅇ(11)
      heads.add(composeIdx(11, jung, jong))
    } else if (jung === 18) {
      // ㅡ -> ㄴ(2) 또는 ㅇ(11)
      heads.add(composeIdx(2, jung, jong))
      heads.add(composeIdx(11, jung, jong))
    } else {
      // 기타 모음 -> ㄴ(2)
      heads.add(composeIdx(2, jung, jong))
    }
  } else if (cho === 2) {
    // ㄴ(2) 초성
    if ([2, 6, 7, 12, 17, 20].includes(jung)) {
      heads.add(composeIdx(11, jung, jong))
    } else if (jung === 18) {
      heads.add(composeIdx(11, jung, jong))
    }
  }

  return [...heads]
}

export function getReqCharDisplay(ch) {
  const heads = allowedHeads(ch)
  if (heads.length <= 1) return heads[0] || ''
  return heads.join(' 또는 ')
}

export function lastCharOf(word) {
  return word ? word[word.length - 1] : ''
}

// 단어 규칙 및 사전 검증
export function checkWord(word, { lastChar, used = [], dictionaryOnly = true }) {
  const raw = (word || '').trim().replace(/\s+/g, '')
  if (!raw) return { ok: false, reason: 'empty' }
  if (!isHangulWord(raw)) return { ok: false, reason: 'hangul' }

  const validHeads = lastChar ? allowedHeads(lastChar) : []
  const startsWithValidHead = !lastChar || validHeads.includes(raw[0])

  if (startsWithValidHead && used.includes(raw)) {
    return { ok: false, reason: 'used' }
  }

  let candidates = []
  // 1. 온전한 단어로 입력한 경우 (2글자 이상)
  if (startsWithValidHead && raw.length >= 2) {
    candidates.push(raw)
  }

  // 2. 접미사만 입력한 경우 (예: '가방' 뒤에 '학' 입력 -> '방학', '사탕' 뒤에 '수육' 입력 -> '탕수육')
  if (lastChar) {
    validHeads.forEach((head) => {
      const combined = head + raw
      if (combined.length >= 2 && !candidates.includes(combined)) {
        candidates.push(combined)
      }
    })
  }

  if (candidates.length === 0) {
    if (!startsWithValidHead && raw.length >= 2) {
      return { ok: false, reason: 'head', validHeads }
    }
    return { ok: false, reason: 'short' }
  }

  const unused = candidates.filter((c) => !used.includes(c))
  if (unused.length === 0) {
    return { ok: false, reason: 'used' }
  }

  if (dictionaryOnly) {
    // 1. 온전한 단어로 입력했고 사전에 있다면 최우선 채택
    if (startsWithValidHead && DICTIONARY_SET.has(raw)) {
      return { ok: true, word: raw }
    }
    // 2. 접미사로 결합된 후보 중 사전에 있는 단어 채택
    const match = unused.find((c) => DICTIONARY_SET.has(c))
    if (match) {
      return { ok: true, word: match }
    }
    // 3. 머리글자가 일치하지 않는 경우
    if (!startsWithValidHead && raw.length >= 2) {
      return { ok: false, reason: 'head', validHeads }
    }
    return { ok: false, reason: 'dict' }
  }

  return { ok: true, word: unused[0] }
}

// 한글 자모 조합기 (IME) 클래스
export class HangulComposer {
  constructor() {
    this.reset()
  }

  reset() {
    this.committed = ''
    this.cho = -1
    this.jung = -1
    this.jong = 0
  }

  currentChar() {
    if (this.cho >= 0 && this.jung >= 0) return composeIdx(this.cho, this.jung, this.jong)
    if (this.cho >= 0) return CHO[this.cho]
    if (this.jung >= 0) return JUNG[this.jung]
    return ''
  }

  get text() {
    return this.committed + this.currentChar()
  }

  commit() {
    this.committed += this.currentChar()
    this.cho = -1
    this.jung = -1
    this.jong = 0
  }

  input(jamo) {
    const vi = JUNG.indexOf(jamo)
    if (vi >= 0) {
      if (this.jong > 0) {
        const jc = JONG[this.jong]
        if (JONG_SPLIT[jc]) {
          const [rem, mv] = JONG_SPLIT[jc]
          this.jong = JONG.indexOf(rem)
          this.commit()
          this.cho = CHO.indexOf(mv)
          this.jung = vi
          this.jong = 0
        } else {
          const mv = CHO.indexOf(jc)
          this.jong = 0
          this.commit()
          this.cho = mv
          this.jung = vi
          this.jong = 0
        }
      } else if (this.jung >= 0) {
        const key = JUNG[this.jung] + jamo
        if (VOWEL_COMBINE[key]) {
          this.jung = JUNG.indexOf(VOWEL_COMBINE[key])
        } else {
          this.commit()
          this.cho = -1
          this.jung = vi
          this.jong = 0
        }
      } else {
        this.jung = vi
      }
    } else {
      if (this.cho < 0 && this.jung < 0) {
        this.cho = CHO.indexOf(jamo)
      } else if (this.jung < 0) {
        this.commit()
        this.cho = CHO.indexOf(jamo)
      } else if (this.jong === 0) {
        const ji = JONG.indexOf(jamo)
        if (ji > 0) this.jong = ji
        else {
          this.commit()
          this.cho = CHO.indexOf(jamo)
        }
      } else {
        const comb = JONG_COMBINE[JONG[this.jong] + jamo]
        if (comb) this.jong = JONG.indexOf(comb)
        else {
          this.commit()
          this.cho = CHO.indexOf(jamo)
        }
      }
    }
  }

  backspace() {
    if (this.jong > 0) {
      const jc = JONG[this.jong]
      this.jong = JONG_SPLIT[jc] ? JONG.indexOf(JONG_SPLIT[jc][0]) : 0
    } else if (this.jung >= 0) {
      const b = VOWEL_BASE[JUNG[this.jung]]
      this.jung = b ? JUNG.indexOf(b) : -1
    } else if (this.cho >= 0) {
      this.cho = -1
    } else if (this.committed.length > 0) {
      this.committed = this.committed.slice(0, -1)
    }
  }
}

// 안전한 시작 제시어 목록 (후속 단어가 풍부한 친근한 낱말)
const SAFE_SEED_WORDS = [
  '사과', '학교', '바다', '토끼', '가방', '연필', '수박',
  '나비', '기차', '우유', '바나나', '고양이', '자전거', '무지개', '병아리',
  '호랑이', '강아지', '도토리', '해바라기', '비행기', '다람쥐', '피아노', '크레파스',
  '자동차', '선풍기', '코끼리', '원숭이', '장난감', '딸기', '초콜릿',
  '선생님', '놀이터', '도서관', '컴퓨터', '풍선', '사탕', '오렌지', '그림책'
]

export function randomSeedWord() {
  return SAFE_SEED_WORDS[Math.floor(Math.random() * SAFE_SEED_WORDS.length)]
}
