import { getMenuImage, getMenuImageSync, SEED_MENU_50 } from './menuService'

export { getMenuImage, getMenuImageSync, SEED_MENU_50 }

// 하위 호환성을 위해 getRecipePhoto를 getMenuImageSync로 매핑
export const getRecipePhoto = (recipe) => {
  if (!recipe) return getMenuImageSync('')
  if (recipe.image_url && recipe.image_url.startsWith('http')) return recipe.image_url
  return getMenuImageSync(recipe.title || '')
}

export const fetchHybridMenuImage = (recipeName, category = '') => {
  return getMenuImage(recipeName, { category })
}

// description은 "재료, 재료, 재료 / 설명" 형태로 쓰지만, 손으로 입력하는 칸이라
// 그 형식을 지키지 않은 값도 들어온다. 어떤 모양이 와도 화면이 깨지지 않게 나눈다.
export function parseDescription(description) {
  const raw = (description || '').trim()
  if (!raw) return { ingredients: [], note: '' }

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

export function parseSteps(steps) {
  if (!steps) return []
  return steps
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)\]]?\s*/, '').trim())
    .filter(Boolean)
}

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

export function sortRecipes(rows) {
  return [...rows].sort((a, b) => a.recipe_id.localeCompare(b.recipe_id))
}
