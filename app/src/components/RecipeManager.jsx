import { useState } from 'react'
import { parseDescription, parseSteps, getRecipePhoto } from '../lib/recipes'

const EMPTY = { title: '', ingredients: '', note: '', cookMinutes: '', steps: '' }

// 줄바꿈이 곧 단계라는 규칙은 말로만 설명하면 잘 안 읽힌다. 예시를 그 모양 그대로 보여준다.
const STEPS_PLACEHOLDER = [
  '한 줄에 한 단계씩 적어주세요. 예)',
  '재료를 먹기 좋은 크기로 썰어요.',
  '냄비에 물 2컵을 붓고 된장을 풀어요.',
  '채소를 넣고 5분 끓여요.',
].join('\n')

// 저장할 때는 다시 "재료 / 설명" 한 줄로 합친다. description 컬럼 하나에 담기 위한
// 규칙이고, parseDescription()이 읽는 형식과 같아야 한다.
function joinDescription({ ingredients, note }) {
  const left = ingredients.trim()
  const right = note.trim()
  if (left && right) return `${left} / ${right}`
  return left || right
}

function draftFrom(recipe) {
  const { ingredients, note } = parseDescription(recipe.description)
  return {
    title: recipe.title || '',
    ingredients: ingredients.join(', '),
    note,
    cookMinutes: recipe.cook_minutes ? String(recipe.cook_minutes) : '',
    steps: recipe.steps || '',
  }
}

function RecipeManager({ recipes, onCreate, onUpdate, onDelete, busy }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [formError, setFormError] = useState('')

  // 공용 레시피는 정책상 UPDATE/DELETE가 0행이 된다. 눌러도 안 되는 버튼을 보여주느니
  // 우리 가족이 넣은 것만 목록에 올린다.
  const mine = recipes.filter((r) => r.family_id)
  const shared = recipes.filter((r) => !r.family_id)

  function startCreate() {
    setEditingId(null)
    setDraft(EMPTY)
    setFormError('')
    setOpen(true)
  }

  function startEdit(recipe) {
    setEditingId(recipe.recipe_id)
    setDraft(draftFrom(recipe))
    setFormError('')
    setOpen(true)
  }

  async function submit(e) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) {
      setFormError('요리명을 입력해주세요.')
      return
    }
    const minutes = draft.cookMinutes.trim()
    if (minutes && !(Number(minutes) >= 1 && Number(minutes) <= 600)) {
      setFormError('조리 시간은 1~600분 사이로 적어주세요.')
      return
    }
    const payload = {
      title,
      description: joinDescription(draft),
      cook_minutes: minutes ? Number(minutes) : null,
      steps: draft.steps.trim() || null,
    }
    const ok = editingId ? await onUpdate(editingId, payload) : await onCreate(payload)
    if (!ok) {
      setFormError('저장하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setOpen(false)
    setDraft(EMPTY)
    setEditingId(null)
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-extrabold text-[19px]">
          <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">메뉴 관리</span>
        </h2>
        {!open && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 bg-secondary-dark text-on-secondary rounded-full px-4 py-2 font-display font-bold text-[13px] active:scale-95 transition duration-150"
          >
            <i className="ph-bold ph-plus text-sm"></i>메뉴 추가
          </button>
        )}
      </div>

      <p className="text-foreground-muted text-[13px] leading-[20px] mb-4">
        여기에 넣은 메뉴가 위의 오늘의 추천 메뉴로 돌아가며 나와요. 기본 메뉴 {shared.length}개는 항상 후보에 있고,
        우리 가족이 추가한 {mine.length}개가 함께 섞여요.
      </p>

      {open && (
        <form onSubmit={submit} className="bg-surface border-2 border-foreground rounded-md shadow-sticker p-4 mb-4 flex flex-col gap-3">
          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">요리명</p>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="예: 김치볶음밥"
              maxLength={60}
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">재료</p>
            <input
              type="text"
              value={draft.ingredients}
              onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
              placeholder="쉼표로 구분 — 예: 묵은지, 찬밥, 달걀"
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">한 줄 설명</p>
            <textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="예: 김치를 먼저 볶아 신맛을 날린 뒤 밥을 넣어요."
              rows={2}
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150 resize-none"
            />
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">
              만드는 법
            </p>
            <textarea
              value={draft.steps}
              onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
              placeholder={STEPS_PLACEHOLDER}
              rows={6}
              maxLength={4000}
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] leading-[22px] border border-border outline-none focus:border-foreground transition duration-150 resize-y"
            />
            <p className="text-[12px] text-foreground-muted mt-1">
              줄바꿈이 곧 단계예요. 번호는 화면에서 자동으로 붙습니다.
            </p>
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">조리 시간(분)</p>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={draft.cookMinutes}
              onChange={(e) => setDraft({ ...draft, cookMinutes: e.target.value })}
              placeholder="예: 15"
              className="w-32 bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
            />
          </div>

          {formError && <p className="text-[13px] text-destructive">{formError}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-secondary-dark text-on-secondary rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
            >
              {busy ? '저장하는 중...' : editingId ? '수정하기' : '추가하기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setEditingId(null)
                setFormError('')
              }}
              className="px-4 py-2.5 text-foreground-muted font-display font-bold text-[14px] active:scale-95 transition duration-150"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {mine.length === 0 ? (
        <p className="text-foreground-muted text-[14px]">아직 우리 가족이 추가한 메뉴가 없어요.</p>
      ) : (
        /* 세로로 쌓으면 메뉴를 넣을수록 화면이 끝없이 길어져 아래 항목이 묻힌다 */
        <ul className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {mine.map((r) => {
            const { ingredients, note } = parseDescription(r.description)
            const photoUrl = getRecipePhoto(r)
            return (
              <li
                key={r.recipe_id}
                className="bg-surface border-2 border-foreground rounded-xl shadow-soft overflow-hidden shrink-0 w-[min(248px,68vw)] snap-start flex flex-col"
              >
                <div className="relative aspect-[16/9] w-full bg-surface-muted overflow-hidden">
                  <img
                    src={photoUrl}
                    alt={r.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 rounded-full p-0.5 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition"
                      aria-label={`${r.title} 수정`}
                    >
                      <i className="ph-bold ph-pencil-simple text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white hover:bg-destructive active:scale-90 transition"
                      aria-label={`${r.title} 삭제`}
                    >
                      <i className="ph-bold ph-trash text-xs"></i>
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  <p className="font-display font-bold text-[15px] flex items-center justify-between">
                    <span className="truncate">{r.title}</span>
                    {r.cook_minutes ? (
                      <span className="font-display font-bold text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                        {r.cook_minutes}분
                      </span>
                    ) : null}
                  </p>
                  {ingredients.length > 0 && (
                    <p className="text-[12px] text-foreground-muted mt-1 truncate">{ingredients.join(' · ')}</p>
                  )}
                  {note && <p className="text-[12px] text-foreground-muted mt-1 leading-[18px] line-clamp-2">{note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default RecipeManager
