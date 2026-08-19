import { useEffect } from 'react'
import { parseDescription, parseSteps } from '../lib/recipes'

// 카드를 누르면 열리는 레시피 상세. 화면을 옮기지 않고 덮어서 보여주는 이유는
// "오늘 뭐 해먹지"를 보다가 한 개를 확인하고 바로 돌아오는 흐름이기 때문이다.
function RecipeDetail({ recipe, onClose }) {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-0"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-surface border-x-2 border-t-2 border-foreground rounded-t-lg shadow-soft flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(86vh, 720px)' }}
        role="dialog"
        aria-modal="true"
        aria-label={`${recipe.title} 레시피`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0" aria-hidden="true">
          <span className="h-1.5 flex-1 bg-tape-blue"></span>
          <span className="h-1.5 flex-1 bg-tape-yellow"></span>
          <span className="h-1.5 flex-1 bg-tape-pink"></span>
          <span className="h-1.5 flex-1 bg-tape-lime"></span>
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-[22px] leading-tight">{recipe.title}</h2>
            {recipe.cook_minutes ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-display font-bold text-primary mt-1">
                <i className="ph-bold ph-clock"></i>
                {recipe.cook_minutes}분
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
            aria-label="닫기"
          >
            <i className="ph-bold ph-x text-lg text-foreground-muted"></i>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {note && <p className="text-[14px] leading-[22px] text-foreground-muted mb-4">{note}</p>}

          {ingredients.length > 0 && (
            <section className="mb-5">
              <h3 className="font-display font-bold text-[15px] mb-2">
                <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">재료</span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {ingredients.map((item) => (
                  <li
                    key={item}
                    className="bg-surface-muted border border-border rounded-full px-3 py-1 text-[13px]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-display font-bold text-[15px] mb-2">
              <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">만드는 법</span>
            </h3>
            {steps.length === 0 ? (
              <p className="text-[14px] text-foreground-muted leading-[21px]">
                아직 조리법이 없어요. 아래 &quot;메뉴 관리&quot;에서 만드는 법을 적어두면 여기에 나와요.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center font-display font-bold text-[12px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-[22px] pt-0.5">{step}</span>
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
