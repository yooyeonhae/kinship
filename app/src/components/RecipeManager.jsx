import { useState } from 'react'
import { parseDescription, parseSteps, getRecipePhoto } from '../lib/recipes'
import { CURATED_FOOD_PHOTOS } from '../lib/menuService'

const EMPTY = { title: '', ingredients: '', note: '', cookMinutes: '', steps: '', imageUrl: '' }

const PHOTO_OPTIONS = [
  { label: '백숙/삼계탕', url: CURATED_FOOD_PHOTOS.chicken_soup, emoji: '🍲' },
  { label: '찌개/탕', url: CURATED_FOOD_PHOTOS.korean_stew, emoji: '🥘' },
  { label: '떡국/만둣국', url: CURATED_FOOD_PHOTOS.tteokguk_soup, emoji: '🥣' },
  { label: '국수/면류', url: CURATED_FOOD_PHOTOS.korean_noodle, emoji: '🍜' },
  { label: '볶음밥/덮밥', url: CURATED_FOOD_PHOTOS.fried_rice, emoji: '🍳' },
  { label: '고기/불고기', url: CURATED_FOOD_PHOTOS.korean_meat, emoji: '🥩' },
  { label: '생선/해물', url: CURATED_FOOD_PHOTOS.grilled_fish, emoji: '🐟' },
  { label: '비빔밥', url: CURATED_FOOD_PHOTOS.bibimbap, emoji: '🥗' },
  { label: '돈가스/분식', url: CURATED_FOOD_PHOTOS.tonkatsu, emoji: '🍱' },
  { label: '파스타', url: CURATED_FOOD_PHOTOS.pasta, emoji: '🍝' },
]

const STEPS_PLACEHOLDER = [
  '한 줄에 한 단계씩 적어주세요. 예)',
  '재료를 먹기 좋은 크기로 썰어요.',
  '냄비에 물 2컵을 붓고 된장을 풀어요.',
  '채소를 넣고 5분 끓여요.',
].join('\n')

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
    imageUrl: recipe.image_url || '',
  }
}

function RecipeManager({ recipes, onCreate, onUpdate, onDelete, busy }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [formError, setFormError] = useState('')

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
      image_url: draft.imageUrl || null,
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

  // 실시간 미리보기 이미지 URL
  const previewPhoto = draft.imageUrl || getRecipePhoto({ title: draft.title })

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
        <form onSubmit={submit} className="bg-surface border-2 border-foreground rounded-xl shadow-sticker p-4 mb-4 flex flex-col gap-3.5">
          {/* 요리 사진 미리보기 및 선택 바 */}
          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-2">
              대표 요리 사진 (자동 매칭 및 선택)
            </p>
            <div className="flex gap-3 items-center mb-2.5">
              <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-foreground bg-surface-muted shrink-0 shadow-soft">
                <img
                  src={previewPhoto}
                  alt="요리 사진 미리보기"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-[12px] text-foreground-muted leading-tight">
                <p className="font-display font-bold text-foreground mb-1">
                  {draft.title ? `"${draft.title}" 매칭 사진` : '요리명에 맞춰 자동 매칭돼요'}
                </p>
                <p>원하는 사진 칩을 직접 클릭하여 지정할 수도 있어요.</p>
              </div>
            </div>

            {/* 빠른 사진 칩 */}
            <div className="flex flex-wrap gap-1.5">
              {PHOTO_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setDraft({ ...draft, imageUrl: opt.url })}
                  className={`text-[11px] font-display font-bold px-2.5 py-1 rounded-full border transition active:scale-95 flex items-center gap-1 ${
                    draft.imageUrl === opt.url
                      ? 'bg-primary text-on-primary border-foreground shadow-xs'
                      : 'bg-surface-muted text-foreground border-border hover:bg-surface'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
              {draft.imageUrl && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, imageUrl: '' })}
                  className="text-[11px] text-destructive hover:underline ml-1 self-center"
                >
                  자동 매칭으로 복원
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">요리명</p>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="예: 누룽지 백숙, 김치볶음밥, 떡국..."
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
              placeholder="쉼표로 구분 — 예: 닭, 찹쌀, 대파, 통마늘"
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">한 줄 설명</p>
            <textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="예: 생찹쌀 대신 누룽지를 넣으면 구수해요."
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
              rows={5}
              maxLength={4000}
              className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] leading-[22px] border border-border outline-none focus:border-foreground transition duration-150 resize-y"
            />
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
              placeholder="예: 40"
              className="w-32 bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
            />
          </div>

          {formError && <p className="text-[13px] text-destructive">{formError}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-secondary-dark text-on-secondary rounded-md py-3 font-display font-bold text-[15px] shadow-sticker active:scale-[0.98] transition duration-150 disabled:opacity-60"
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
              className="px-4 py-3 text-foreground-muted font-display font-bold text-[14px] active:scale-95 transition duration-150"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {mine.length === 0 ? (
        <p className="text-foreground-muted text-[14px]">아직 우리 가족이 추가한 메뉴가 없어요.</p>
      ) : (
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
