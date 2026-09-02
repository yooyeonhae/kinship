import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import FavoriteLinks from '../components/FavoriteLinks'
import RecipeManager from '../components/RecipeManager'
import RecipeDetail from '../components/RecipeDetail'
import { parseDescription, pickTodayRecipes, sortRecipes, getRecipePhoto, fetchHybridMenuImage } from '../lib/recipes'

// 카드가 두 장이라 장식도 두 벌이다. 목업의 기울기·스티커 위치를 그대로 쓴다.
const CARD_DECOR = [
  { rotate: '-rotate-1', badge: 'absolute -bottom-3 right-3', badgeBg: 'bg-accent', badgeFg: 'text-on-accent', timeColor: 'text-primary' },
  { rotate: 'rotate-2', badge: 'absolute -top-3 left-3', badgeBg: 'bg-primary', badgeFg: 'text-on-primary', timeColor: 'text-secondary' },
]

function RecipeCard({ recipe, decor, onOpen }) {
  const { ingredients, note } = parseDescription(recipe.description)
  const [photoUrl, setPhotoUrl] = useState(() => getRecipePhoto(recipe))

  // 1차가 fallback인 경우 2차 외부 검색&캐싱 비동기 호출
  useEffect(() => {
    let alive = true
    const initial = getRecipePhoto(recipe)
    setPhotoUrl(initial)

    fetchHybridMenuImage(recipe.title).then((url) => {
      if (alive && url && url !== initial) {
        setPhotoUrl(url)
      }
    })

    return () => {
      alive = false
    }
  }, [recipe.title, recipe.image_url])

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${recipe.title} 레시피 보기`}
      className={`${decor.rotate} text-left bg-surface border-2 border-foreground rounded-xl shadow-sticker overflow-hidden active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 flex flex-col`}
    >
      {/* 실제 음식 사진 영역 */}
      <div className="relative aspect-[4/3] w-full bg-surface-muted overflow-hidden">
        <img
          src={photoUrl}
          alt={recipe.title}
          className="w-full h-full object-cover transition duration-300 hover:scale-105"
          loading="lazy"
        />
        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

        <span className={`${decor.badge} w-8 h-8 rounded-full ${decor.badgeBg} ring-4 ring-surface shadow-soft flex items-center justify-center`} aria-hidden="true">
          <i className={`ph-fill ph-star ${decor.badgeFg} text-xs`}></i>
        </span>
      </div>

      <div className="p-3 pt-3.5 flex-1 flex flex-col justify-between">
        <div>
          <h2 className="font-display font-extrabold text-[17px] leading-tight mb-1.5 text-foreground">
            {recipe.title}
          </h2>

          {ingredients.length > 0 && (
            <ul className="flex flex-wrap gap-1 mb-2">
              {ingredients.map((item) => (
                <li key={item} className="bg-surface-muted rounded-full px-2 py-0.5 text-[11px] text-foreground-muted border border-border/60">
                  {item}
                </li>
              ))}
            </ul>
          )}

          {note && <p className="text-[12px] text-foreground-muted leading-[18px] mb-2 line-clamp-2">{note}</p>}
        </div>

        <div className="border-t border-dashed border-border pt-2 flex items-center justify-between mt-1">
          {recipe.cook_minutes ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-display font-bold ${decor.timeColor}`}>
              <i className="ph-bold ph-clock"></i>
              {recipe.cook_minutes}분
            </span>
          ) : (
            <span></span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[11px] font-display font-bold text-foreground-muted">
            레시피 보기
            <i className="ph-bold ph-caret-right text-[10px]"></i>
          </span>
        </div>
      </div>
    </button>
  )
}

function ParentRecipeScreen() {
  const { supabase, familyId } = useFamily()

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openRecipe, setOpenRecipe] = useState(null)

  const load = useCallback(async () => {
    if (!familyId) return
    setLoading(true)
    const { data, error } = await supabase.from('recipes').select('*')
    if (error) {
      // family_id/cook_minutes 열이 없으면 migration_07을 아직 실행하지 않은 것이다
      if (/column|schema cache/i.test(`${error.message} ${error.details}`)) setNeedsMigration(true)
      else setErrorMsg('메뉴를 불러오지 못했어요.')
      setLoading(false)
      return
    }
    setErrorMsg('')
    setRecipes(sortRecipes(data || []))
    setLoading(false)
  }, [supabase, familyId])

  useEffect(() => {
    load()
  }, [load])

  // 오늘 날짜로 정한다 — 무작위로 뽑으면 새로고침마다 바뀌고, 가족끼리 다른 메뉴를 본다.
  const todays = useMemo(() => pickTodayRecipes(recipes, 2), [recipes])

  async function createRecipe(payload) {
    setBusy(true)
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...payload, family_id: familyId })
      .select()
      .single()
    setBusy(false)
    if (error) return false
    setRecipes((prev) => sortRecipes([...prev, data]))
    return true
  }

  async function updateRecipe(recipeId, payload) {
    setBusy(true)
    const { data, error } = await supabase
      .from('recipes')
      .update(payload)
      .eq('recipe_id', recipeId)
      .select()
      .single()
    setBusy(false)
    if (error) return false
    setRecipes((prev) => sortRecipes(prev.map((r) => (r.recipe_id === recipeId ? data : r))))
    setOpenRecipe((prev) => (prev && prev.recipe_id === recipeId ? data : prev))
    return true
  }

  async function deleteRecipe(recipe) {
    const { error } = await supabase.from('recipes').delete().eq('recipe_id', recipe.recipe_id)
    if (error) {
      setErrorMsg('메뉴를 삭제하지 못했어요.')
      return
    }
    setErrorMsg('')
    setRecipes((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id))
    setOpenRecipe((prev) => (prev && prev.recipe_id === recipe.recipe_id ? null : prev))
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">퇴근 길 메뉴 고민은 그만!</h1>
        <p className="flex items-center gap-1.5 text-foreground-muted text-[15px] leading-[22px] mt-2">
          오늘의 추천 메뉴입니다
          <i className="ph-fill ph-heart text-accent text-base" aria-hidden="true"></i>
        </p>
      </div>

      {needsMigration && (
        <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4">
          <p className="text-[13px] text-destructive leading-[19px]">
            메뉴 테이블이 아직 준비되지 않았어요. Supabase SQL Editor에서 <strong>migration_07_recipes.sql</strong>을 실행해주세요.
          </p>
        </div>
      )}
      {errorMsg && !needsMigration && <p className="text-[13px] text-destructive mb-4">{errorMsg}</p>}

      {loading ? (
        <p className="text-foreground-muted text-[14px] py-4">메뉴를 불러오는 중...</p>
      ) : todays.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-md px-4 py-6 text-center">
          <p className="text-foreground-muted text-[14px] leading-[21px]">
            등록된 메뉴가 없어요.
            <br />
            아래 &quot;메뉴 관리&quot;에서 오늘 해먹을 메뉴를 추가해보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {todays.map((recipe, i) => (
            <RecipeCard
              key={recipe.recipe_id}
              recipe={recipe}
              decor={CARD_DECOR[i % CARD_DECOR.length]}
              onOpen={() => setOpenRecipe(recipe)}
            />
          ))}
        </div>
      )}

      {openRecipe && <RecipeDetail recipe={openRecipe} onClose={() => setOpenRecipe(null)} />}

      <RecipeManager
        recipes={recipes}
        onCreate={createRecipe}
        onUpdate={updateRecipe}
        onDelete={deleteRecipe}
        busy={busy}
      />

      <FavoriteLinks />

      <div className="flex-1"></div>

      <Link
        to="/parent-tasks"
        className="mt-6 bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
      >
        확인 (To Tasks)
        <i className="ph-bold ph-arrow-right text-lg"></i>
      </Link>
    </>
  )
}

export default ParentRecipeScreen
