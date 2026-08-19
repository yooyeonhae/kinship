// 오늘의 추천 메뉴를 고르고, description을 화면에서 읽기 좋게 나누는 규칙.

// description은 "재료, 재료, 재료 / 설명" 형태로 쓰지만, 손으로 입력하는 칸이라
// 그 형식을 지키지 않은 값도 들어온다. 어떤 모양이 와도 화면이 깨지지 않게 나눈다.
export function parseDescription(description) {
  const raw = (description || '').trim()
  if (!raw) return { ingredients: [], note: '' }

  // '/'가 있으면 앞이 재료, 뒤가 설명. 없으면 전체를 설명으로 본다.
  const slash = raw.indexOf('/')
  const head = slash === -1 ? '' : raw.slice(0, slash)
  const tail = slash === -1 ? raw : raw.slice(slash + 1)

  const ingredients = head
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)

  return { ingredients, note: tail.trim() }
}

// 조리 순서는 여러 줄 텍스트 한 칸에 담긴다(migration_12). 화면에서 줄 단위로 나눠
// 번호를 붙이므로, 사용자가 이미 "1." "1)" 같은 번호를 적어 넣었으면 지운다 —
// 그대로 두면 "1. 1. 재료를 썰어요"가 된다.
export function parseSteps(steps) {
  if (!steps) return []
  return steps
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)\]]?\s*/, '').trim())
    .filter(Boolean)
}

// 같은 날이면 가족 모두가 같은 메뉴를 봐야 한다. 부모가 "오늘 카레래"라고 말했는데
// 상대 화면에 다른 게 떠 있으면 대화가 어긋난다. 그래서 무작위가 아니라 날짜로 정한다.
// 새로고침해도 바뀌지 않는다는 것도 "오늘의" 메뉴가 되기 위한 조건이다.
export function dayNumber(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

export function pickTodayRecipes(recipes, count = 2, date = new Date()) {
  const n = recipes.length
  if (n === 0) return []
  if (n <= count) return recipes

  const day = dayNumber(date)
  const first = day % n
  const picked = [recipes[first]]

  // 서로 다른 메뉴가 나오도록 1 이상 n-1 이하의 간격을 쓴다.
  // 간격이 n의 약수면 같은 메뉴가 다시 걸리므로 매번 다음 칸으로 밀며 채운다.
  let step = 1 + (Math.floor(day / n) % (n - 1))
  let idx = first
  while (picked.length < count) {
    idx = (idx + step) % n
    if (picked.includes(recipes[idx])) {
      idx = (idx + 1) % n
      step += 1
    }
    if (!picked.includes(recipes[idx])) picked.push(recipes[idx])
  }
  return picked
}

// 정렬을 고정해두지 않으면 회전의 기준 자체가 흔들려 "오늘의 메뉴"가 날마다 엉뚱해진다.
export function sortRecipes(rows) {
  return [...rows].sort((a, b) => a.recipe_id.localeCompare(b.recipe_id))
}
