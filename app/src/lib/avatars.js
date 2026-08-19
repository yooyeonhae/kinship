// 구성원이 고르는 캐릭터. 이미지 대신 이모지를 쓰는 이유는 migration_11 주석 참고.

// 12지신(띠) 동물. 부모와 자녀가 같은 후보에서 고른다 — 부모만 직업 이모지를 쓰면
// 가족 안에서 어른과 아이가 다른 종류의 존재처럼 보이고, 무엇보다 아이가 부모 캐릭터를
// 알아보기 어렵다. 띠는 온 가족이 하나씩 갖고 있어 "누가 무슨 띠"로 고르기도 쉽다.
export const ZODIAC_CHARACTERS = [
  { emoji: '🐭', label: '쥐' },
  { emoji: '🐮', label: '소' },
  { emoji: '🐯', label: '호랑이' },
  { emoji: '🐰', label: '토끼' },
  { emoji: '🐲', label: '용' },
  { emoji: '🐍', label: '뱀' },
  { emoji: '🐴', label: '말' },
  { emoji: '🐑', label: '양' },
  { emoji: '🐵', label: '원숭이' },
  { emoji: '🐔', label: '닭' },
  { emoji: '🐶', label: '개' },
  { emoji: '🐷', label: '돼지' },
]

const EMOJIS = ZODIAC_CHARACTERS.map((c) => c.emoji)

export const CHILD_CHARACTERS = EMOJIS
export const PARENT_CHARACTERS = EMOJIS

export function labelFor(emoji) {
  return ZODIAC_CHARACTERS.find((c) => c.emoji === emoji)?.label || ''
}

// 부모·자녀가 같은 후보를 쓰지만, 호출부가 역할을 넘기는 형태는 그대로 둔다 —
// 나중에 다시 갈라야 할 때 호출부를 손대지 않아도 되도록.
export function charactersFor() {
  return EMOJIS
}

// 아직 캐릭터를 고르지 않은 구성원에게도 뭔가는 보여야 한다. 이름으로 정하면
// 같은 사람에게 늘 같은 캐릭터가 붙어서, 고르기 전에도 자리가 흔들리지 않는다.
export function fallbackCharacter(member) {
  if (!member) return '🐣'
  const pool = charactersFor(member.role)
  const name = member.name || ''
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return pool[sum % pool.length]
}

export function characterOf(member) {
  return member?.avatar || fallbackCharacter(member)
}
