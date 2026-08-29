// 끝말잇기. 사전은 쓰지 않는다 — 국어사전 API는 별도 키가 필요하고, 아이들이 쓰는
// 말(인형 이름, 줄임말)은 사전에 없어서 "맞는 말인데 안 된다"가 더 자주 생긴다.
// 그래서 여기서 검사하는 것은 기계적으로 확실한 것만이고, 실제로 있는 낱말인지는
// 가족이 함께 판단한다. 이 경계는 화면에도 적어둔다.

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const CHO_N = 2
const CHO_R = 5
const CHO_IEUNG = 11

// 두음법칙에서 ㅇ으로 바뀌는 모음(ㅑㅒㅕㅖㅛㅠㅣ). 그 외에는 ㄹ→ㄴ이다.
const Y_VOWELS = new Set([2, 3, 6, 7, 12, 17, 20])

function isHangulSyllable(ch) {
  const code = ch.codePointAt(0)
  return code >= HANGUL_START && code <= HANGUL_END
}

export function isHangulWord(word) {
  return word.length > 0 && [...word].every(isHangulSyllable)
}

function decompose(ch) {
  const i = ch.codePointAt(0) - HANGUL_START
  return { cho: Math.floor(i / 588), jung: Math.floor((i % 588) / 28), jong: i % 28 }
}

function compose({ cho, jung, jong }) {
  return String.fromCodePoint(HANGUL_START + (cho * 21 + jung) * 28 + jong)
}

// 이 글자로 시작해도 되는 글자들. 첫째가 원래 글자이고, 뒤는 두음법칙으로 바뀐 형태다.
// (락 → 낙, 려 → 여, 니 → 이) 아이들과 하는 끝말잇기에서는 보통 이걸 인정한다.
export function allowedHeads(ch) {
  if (!ch || !isHangulSyllable(ch)) return []
  const heads = [ch]
  const { cho, jung, jong } = decompose(ch)
  if (cho === CHO_R) {
    heads.push(compose({ cho: Y_VOWELS.has(jung) ? CHO_IEUNG : CHO_N, jung, jong }))
  } else if (cho === CHO_N && Y_VOWELS.has(jung)) {
    heads.push(compose({ cho: CHO_IEUNG, jung, jong }))
  }
  return heads
}

export function lastCharOf(word) {
  return word ? word[word.length - 1] : ''
}

// 앞 단어의 끝 글자로 이을 수 있는지. 돌려주는 reason은 화면에서 문장으로 바꾼다.
export function checkWord(word, { lastChar, used }) {
  const w = word.trim()
  if (!w) return { ok: false, reason: 'empty' }
  if (!isHangulWord(w)) return { ok: false, reason: 'hangul' }
  if (w.length < 2) return { ok: false, reason: 'short' }
  if (used.includes(w)) return { ok: false, reason: 'used' }
  if (lastChar && !allowedHeads(lastChar).includes(w[0])) return { ok: false, reason: 'head' }
  return { ok: true, word: w }
}

// 첫 단어. 사람이 아무 말이나 시작하게 두면 "무슨 말부터 해?"에서 멈추고,
// 끝 글자가 어려운 말(예: 늪)로 시작하면 첫 차례부터 막힌다. 그래서 앱이 낸다.
const SEED_WORDS = [
  '사과', '학교', '바다', '구름', '토끼', '가방', '연필', '수박',
  '나비', '기차', '우유', '바나나', '고양이', '자전거', '무지개', '병아리',
]

export function randomSeedWord() {
  return SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]
}
