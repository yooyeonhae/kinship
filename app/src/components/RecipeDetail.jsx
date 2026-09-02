import { useEffect, useState } from 'react'
import { parseDescription, parseSteps, getRecipePhoto, fetchHybridMenuImage } from '../lib/recipes'

// 카드를 누르면 열리는 레시피 상세. 화면을 옮기지 않고 덮어서 보여주는 이유는
// "오늘 뭐 해먹지"를 보다가 한 개를 확인하고 바로 돌아오는 흐름이기 때문이다.
function RecipeDetail({ recipe, onClose }) {
  const [photoUrl, setPhotoUrl] = useState(() => getRecipePhoto(recipe))

  useEffect(() => {
    let alive = true
    const initial = getRecipePhoto(recipe)
    setPhotoUrl(initial)

    fetchHybridMenuImage(recipe?.title).then((url) => {
      if (alive && url && url !== initial) {
        setPhotoUrl(url)
      }
    })

    return () => {
      alive = false
    }
  }, [recipe?.title, recipe?.image_url])
  // 열려 있는 동안 뒤 화면이 같이 스크롤되면 어디를 보고 있었는지 잃는다
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!recipe) return null

  const { ingredients, note } = parseDescription(recipe.description)
  const steps = parseSteps(recipe.steps)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 backdrop-blur-xs px-4 pb-0 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-surface border-x-2 border-t-2 border-foreground rounded-t-2xl shadow-sticker flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(90vh, 760px)' }}
        role="dialog"
        aria-modal="true"
        aria-label={`${recipe.title} 레시피`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 장식 바 */}
        <div className="flex shrink-0" aria-hidden="true">
          <span className="h-1.5 flex-1 bg-tape-blue"></span>
          <span className="h-1.5 flex-1 bg-tape-yellow"></span>
          <span className="h-1.5 flex-1 bg-tape-pink"></span>
          <span className="h-1.5 flex-1 bg-tape-lime"></span>
        </div>

        {/* 실제 음식 사진 히어로 배너 */}
        <div className="relative aspect-[16/9] w-full bg-surface-muted overflow-hidden shrink-0">
          <img
            src={photoUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

          {/* 닫기 버튼 (사진 우측 상단 플로팅) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center shrink-0 active:scale-90 transition duration-150 hover:bg-black/80 shadow-md"
            aria-label="닫기"
          >
            <i className="ph-bold ph-x text-base"></i>
          </button>

          {/* 제목 & 조리시간 (사진 좌측 하단) */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="font-display font-extrabold text-[22px] leading-tight drop-shadow-md">
              {recipe.title}
            </h2>
            {recipe.cook_minutes ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-display font-bold text-tape-yellow mt-1 bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                <i className="ph-bold ph-clock"></i>
                조리 시간 {recipe.cook_minutes}분
              </span>
            ) : null}
          </div>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {note && (
            <p className="text-[14px] leading-[22px] text-foreground-muted bg-surface-muted p-3 rounded-xl border border-border">
              {note}
            </p>
          )}

          {ingredients.length > 0 && (
            <section>
              <h3 className="font-display font-bold text-[15px] mb-2 flex items-center gap-1.5">
                <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">재료 준비</span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {ingredients.map((item) => (
                  <li
                    key={item}
                    className="bg-surface-muted border border-border rounded-full px-3 py-1 text-[13px] text-foreground font-display font-bold"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="pb-4">
            <h3 className="font-display font-bold text-[15px] mb-2.5 flex items-center gap-1.5">
              <span className="bg-tape-pink/60 px-1.5 rotate-1 inline-block">만드는 법</span>
            </h3>
            {steps.length === 0 ? (
              <p className="text-[14px] text-foreground-muted leading-[21px]">
                아직 조리법이 없어요. 아래 &quot;메뉴 관리&quot;에서 만드는 법을 적어두면 여기에 나와요.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 bg-surface-muted/60 p-2.5 rounded-lg border border-border/60">
                    <span className="w-6 h-6 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center font-display font-bold text-[12px] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-[22px] pt-0.5 text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default RecipeDetail
