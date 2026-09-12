import { useRef, useState } from 'react'
import { parseDescription, parseSteps, getRecipePhoto } from '../lib/recipes'
import { CURATED_FOOD_PHOTOS } from '../lib/menuService'
import { compressImage } from '../lib/imageUtils'
import { useFamily } from '../context/FamilyContext'

const EMPTY = { title: '', ingredients: '', note: '', cookMinutes: '', steps: '', imageUrl: '' }

const PHOTO_OPTIONS = [
  { label: '된장찌개', url: CURATED_FOOD_PHOTOS.doenjang_jjigae, emoji: '🥘' },
  { label: '김치찌개', url: CURATED_FOOD_PHOTOS.kimchi_jjigae, emoji: '🍲' },
  { label: '순두부찌개', url: CURATED_FOOD_PHOTOS.sundubu_jjigae, emoji: '🫕' },
  { label: '백숙/삼계탕', url: CURATED_FOOD_PHOTOS.chicken_soup, emoji: '🍲' },
  { label: '소고기미역국', url: CURATED_FOOD_PHOTOS.miyeokguk, emoji: '🍲' },
  { label: '떡국/만둣국', url: CURATED_FOOD_PHOTOS.tteokguk_soup, emoji: '🥣' },
  { label: '국수/면류', url: CURATED_FOOD_PHOTOS.korean_noodle, emoji: '🍜' },
  { label: '김치볶음밥', url: CURATED_FOOD_PHOTOS.fried_rice, emoji: '🍳' },
  { label: '참치마요', url: CURATED_FOOD_PHOTOS.tuna_mayo, emoji: '🍚' },
  { label: '오므라이스', url: CURATED_FOOD_PHOTOS.omurice, emoji: '🍛' },
  { label: '닭볶음탕', url: CURATED_FOOD_PHOTOS.dakbokkeum, emoji: '🍗' },
  { label: '갈비찜', url: CURATED_FOOD_PHOTOS.galbijjim, emoji: '🍖' },
  { label: '제육볶음', url: CURATED_FOOD_PHOTOS.jeyuk_bokkeum, emoji: '🥓' },
  { label: '소불고기', url: CURATED_FOOD_PHOTOS.bulgogi, emoji: '🥘' },
  { label: '삼겹살구이', url: CURATED_FOOD_PHOTOS.samgyeopsal, emoji: '🥓' },
  { label: '보쌈/수육', url: CURATED_FOOD_PHOTOS.bossam_suyuk, emoji: '🥩' },
  { label: '생선/백반', url: CURATED_FOOD_PHOTOS.grilled_fish, emoji: '🐟' },
  { label: '비빔밥', url: CURATED_FOOD_PHOTOS.bibimbap, emoji: '🥗' },
  { label: '잡채', url: CURATED_FOOD_PHOTOS.japchae, emoji: '🍜' },
  { label: '두부조림', url: CURATED_FOOD_PHOTOS.tofu_jorim, emoji: '🥘' },
  { label: '떡볶이', url: CURATED_FOOD_PHOTOS.tteokbokki, emoji: '🥘' },
  { label: '계란말이', url: CURATED_FOOD_PHOTOS.egg_roll, emoji: '🥚' },
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
  const { supabase, familyId } = useFamily()
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [formError, setFormError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [processingPhoto, setProcessingPhoto] = useState(false)

  const mine = recipes.filter((r) => r.family_id)
  const shared = recipes.filter((r) => !r.family_id)

  function startCreate() {
    setEditingId(null)
    setDraft(EMPTY)
    setFormError('')
    setPhotoError('')
    setOpen(true)
  }

  function startEdit(recipe) {
    setEditingId(recipe.recipe_id)
    setDraft(draftFrom(recipe))
    setFormError('')
    setPhotoError('')
    setOpen(true)
  }

  // 사진 촬영 및 앨범 선택 처리 (압축 + 필요 시 스토리지 업로드 / Base64 동기화)
  async function handlePhotoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    setProcessingPhoto(true)

    try {
      // 1. 최대 900px, 0.82 압축 (고화질 유지하면서 40~70KB로 최적화)
      const compressed = await compressImage(file, 900, 0.82)
      let finalUrl = compressed.base64

      // 2. Supabase Storage 버킷이 사용 가능할 경우 저장 시도
      if (supabase && familyId) {
        try {
          const filePath = `${familyId}/recipes/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`
          const { error: uploadErr } = await supabase.storage
            .from('recipes')
            .upload(filePath, compressed.blob, { contentType: 'image/webp', upsert: true })

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('recipes').getPublicUrl(filePath)
            if (urlData?.publicUrl) {
              finalUrl = urlData.publicUrl
            }
          }
        } catch {
          // 스토리지 에러 시에도 base64 dataURL로 100% 정상 작동
        }
      }

      setDraft((prev) => ({
        ...prev,
        imageUrl: finalUrl,
      }))
    } catch (err) {
      setPhotoError(err.message || '사진을 불러오지 못했습니다.')
    } finally {
      setProcessingPhoto(false)
      if (e.target) e.target.value = ''
    }
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

  // 사용자가 직접 촬영/등록한 사진 여부 판별
  const isUserCustomPhoto = Boolean(
    draft.imageUrl &&
      (draft.imageUrl.startsWith('data:image/') || !PHOTO_OPTIONS.some((opt) => opt.url === draft.imageUrl))
  )

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
          {/* 요리 사진 등록 (촬영 · 앨범 · 선택) */}
          <div className="bg-surface-muted/60 border border-border rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-display font-bold text-[13px] tracking-wide text-foreground flex items-center gap-1.5">
                <i className="ph-bold ph-camera text-primary text-base"></i>
                <span>요리 사진 등록 (직접 촬영 · 앨범)</span>
              </p>
              {isUserCustomPhoto && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 flex items-center gap-1">
                  <i className="ph-bold ph-check-circle"></i>
                  <span>직접 등록한 사진</span>
                </span>
              )}
            </div>

            {/* 숨겨진 파일 인풋: 카메라 직접 촬영 및 앨범/갤러리 선택 */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handlePhotoFile}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePhotoFile}
              className="hidden"
            />

            <div className="flex gap-3 items-center">
              {/* 사진 미리보기 박스 */}
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-foreground bg-surface shrink-0 shadow-soft">
                <img
                  src={previewPhoto}
                  alt="요리 사진 미리보기"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {processingPhoto && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-[11px] gap-1">
                    <i className="ph-bold ph-circle-notch animate-spin text-lg"></i>
                    <span>압축 중...</span>
                  </div>
                )}
              </div>

              {/* 촬영 & 앨범 선택 버튼 */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    disabled={processingPhoto}
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 min-w-[105px] inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary border-2 border-foreground rounded-lg py-2 px-3 font-display font-bold text-[13px] shadow-xs active:translate-x-0.5 active:translate-y-0.5 transition duration-150 disabled:opacity-60"
                  >
                    <i className="ph-bold ph-camera text-base"></i>
                    <span>사진 촬영</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-w-[105px] inline-flex items-center justify-center gap-1.5 bg-surface text-foreground border border-border hover:border-foreground/50 rounded-lg py-2 px-3 font-display font-bold text-[13px] shadow-xs active:scale-[0.98] transition duration-150 disabled:opacity-60"
                  >
                    <i className="ph-bold ph-image text-base"></i>
                    <span>앨범에서 선택</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                  <span className="truncate">
                    {draft.imageUrl
                      ? (isUserCustomPhoto ? '카메라/앨범 사진 적용 중' : '선택한 칩 사진 적용 중')
                      : (draft.title ? `"${draft.title}" 자동 매칭 중` : '직접 찍거나 앨범에서 골라보세요')}
                  </span>
                  {draft.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, imageUrl: '' }))}
                      className="text-destructive font-bold hover:underline shrink-0 ml-2"
                    >
                      기본으로 복원
                    </button>
                  )}
                </div>
              </div>
            </div>

            {photoError && <p className="text-[12px] text-destructive mt-2">{photoError}</p>}

            {/* 추천 사진 칩 (아코디언 토글) */}
            <details className="group mt-3 pt-2.5 border-t border-border/70">
              <summary className="cursor-pointer text-[12px] font-bold text-foreground-muted hover:text-foreground flex items-center justify-between select-none py-1">
                <span className="flex items-center gap-1">
                  <span>앱 기본 사진 칩에서 고르기</span>
                  <span className="text-[10px] font-normal text-foreground-muted/70">({PHOTO_OPTIONS.length}개)</span>
                </span>
                <i className="ph-bold ph-caret-down transition-transform group-open:rotate-180 text-sm"></i>
              </summary>
              <div className="flex flex-wrap gap-1.5 pt-2.5 max-h-36 overflow-y-auto">
                {PHOTO_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDraft({ ...draft, imageUrl: opt.url })}
                    className={`text-[11px] font-display font-bold px-2.5 py-1 rounded-full border transition active:scale-95 flex items-center gap-1 ${
                      draft.imageUrl === opt.url
                        ? 'bg-primary text-on-primary border-foreground shadow-xs'
                        : 'bg-surface text-foreground border-border hover:bg-surface-muted'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </details>
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
                    referrerPolicy="no-referrer"
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
