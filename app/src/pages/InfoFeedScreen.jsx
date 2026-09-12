import { useCallback, useEffect, useState } from 'react'
import { fetchNews } from '../lib/news'
import { useFamily } from '../context/FamilyContext'
import TodayInHistoryCard from '../components/infofeed/TodayInHistoryCard'
import ScienceTriviaCard from '../components/infofeed/ScienceTriviaCard'
import KoreanWordsCard from '../components/infofeed/KoreanWordsCard'
import EnglishWordCard from '../components/infofeed/EnglishWordCard'
import QuizAndThoughtCard from '../components/infofeed/QuizAndThoughtCard'

// 성인/부모 기본 카테고리 (경제, 주식, 정책, 스포츠)
export const DEFAULT_ADULT_CATEGORIES = [
  { id: 'c1', type: 'news', label: '경제 헤드라인', icon: 'ph-chart-line-up', query: '경제' },
  { id: 'c2', type: 'news', label: '주식', icon: 'ph-trend-up', query: '코스피' },
  { id: 'c3', type: 'news', label: '국가 혜택 · 정책', icon: 'ph-bank', query: '육아 지원 정책' },
  { id: 'c4', type: 'news', label: '스포츠', icon: 'ph-basketball', query: '프로야구' },
]

// 아이들 전용 기본 카테고리 (역사 속 오늘, 과학·우주, 생각질문&퀴즈, 순우리말·고사성어·속담, 실생활 영어)
export const DEFAULT_KID_CATEGORIES = [
  { id: 'kid_history', type: 'kid_history', label: '역사 속 오늘', icon: 'ph-hourglass-high' },
  { id: 'kid_science', type: 'kid_science', label: '과학 · 우주', icon: 'ph-planet' },
  { id: 'kid_quiz', type: 'kid_quiz', label: '생각 질문 & 퀴즈', icon: 'ph-lightbulb' },
  { id: 'kid_korean', type: 'kid_korean', label: '순우리말 · 고사성어 · 속담', icon: 'ph-translate' },
  { id: 'kid_english', type: 'kid_english', label: '실생활 영어 표현', icon: 'ph-globe' },
]

// 빠른 추가 추천 목록
const QUICK_RECOMMENDED_OPTIONS = [
  { id: 'kid_history', type: 'kid_history', label: '📜 역사 속 오늘' },
  { id: 'kid_science', type: 'kid_science', label: '🚀 과학 · 우주 한 줄' },
  { id: 'kid_quiz', type: 'kid_quiz', label: '💭 생각 질문 & 퀴즈' },
  { id: 'kid_korean', type: 'kid_korean', label: '🌸 순우리말 · 고사성어 · 속담' },
  { id: 'kid_english', type: 'kid_english', label: '🔤 실생활 영어 표현' },
  { id: 'rec_economy', type: 'news', label: '📈 경제 헤드라인', query: '경제', icon: 'ph-chart-line-up' },
  { id: 'rec_stock', type: 'news', label: '📊 주식 (코스피)', query: '코스피', icon: 'ph-trend-up' },
  { id: 'rec_policy', type: 'news', label: '🏛️ 육아 혜택 · 정책', query: '육아 지원 정책', icon: 'ph-bank' },
  { id: 'rec_sports', type: 'news', label: '⚽ 스포츠', query: '프로야구', icon: 'ph-basketball' },
  { id: 'rec_weather', type: 'news', label: '⛅ 오늘의 날씨', query: '오늘 날씨', icon: 'ph-cloud-sun' },
  { id: 'rec_ai', type: 'news', label: '🤖 인공지능 · IT', query: '인공지능 IT', icon: 'ph-cpu' },
]

const ITEMS_PER_CATEGORY = 3

// 개인별 고유 로컬 스토리지 키 생성
function getStorageKey(memberId, isChild) {
  if (memberId) return `kinship_feed_cats_m_${memberId}`
  return `kinship_feed_cats_role_${isChild ? 'child' : 'parent'}`
}

function loadCategoriesFromLocal(memberId, isChild) {
  const key = getStorageKey(memberId, isChild)
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (isChild) {
          const hasEnglish = parsed.some((c) => c.type === 'kid_english' || c.id === 'kid_english')
          const updated = parsed.map((c) => {
            if (c.id === 'kid_word' || c.type === 'kid_word') {
              return { ...c, id: 'kid_korean', type: 'kid_korean', label: '순우리말 · 고사성어 · 속담' }
            }
            if (c.id === 'kid_quiz' || c.type === 'kid_quiz') {
              return { ...c, label: '생각 질문 & 퀴즈' }
            }
            return c
          })
          if (!hasEnglish) {
            updated.push({
              id: 'kid_english',
              type: 'kid_english',
              label: '실생활 영어 표현',
              icon: 'ph-globe',
            })
          }
          return updated
        }
        return parsed
      }
    }
  } catch {}
  return isChild ? DEFAULT_KID_CATEGORIES : DEFAULT_ADULT_CATEGORIES
}

function ItemAddForm({ onAdd }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = value.trim()
        if (!v) return
        onAdd(v)
        setValue('')
      }}
      className="item-add-form flex items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="새 소식 제목 추가"
        className="flex-1 min-w-0 bg-surface-muted rounded-md px-3 py-2 text-[14px] border border-border outline-none focus:border-foreground transition"
        autoComplete="off"
      />
      <button
        type="submit"
        className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150 shadow-xs"
        aria-label="소식 추가"
      >
        <i className="ph-bold ph-plus text-base"></i>
      </button>
    </form>
  )
}

function InfoFeedScreen() {
  const { currentMemberId, currentMember, isChild, familyId, supabase } = useFamily()

  // 1. 개인별 맞춤 카테고리 상태 관리 (초기화는 로컬스토리지에서 즉시 로드)
  const [categories, setCategories] = useState(() => loadCategoriesFromLocal(currentMemberId, isChild))
  const [categoryInput, setCategoryInput] = useState('')
  const [feeds, setFeeds] = useState({})

  // 사용자 전환(로그인 변경/아이-부모 전환) 시 해당 멤버의 카테고리 로드
  useEffect(() => {
    const local = loadCategoriesFromLocal(currentMemberId, isChild)
    setCategories(local)

    // Supabase DB 백엔드에 저장된 설정이 있다면 비동기 동기화
    if (supabase && currentMemberId) {
      supabase
        .from('member_feed_preferences')
        .select('categories')
        .eq('member_id', currentMemberId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data?.categories && Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories)
            const key = getStorageKey(currentMemberId, isChild)
            localStorage.setItem(key, JSON.stringify(data.categories))
          }
        })
        .catch(() => {})
    }
  }, [currentMemberId, isChild, supabase])

  // 카테고리 변경 시 개인별 로컬스토리지 및 Supabase DB에 영구 저장 (고정 유지)
  const saveCategories = useCallback(
    (newCategories) => {
      setCategories(newCategories)
      const key = getStorageKey(currentMemberId, isChild)
      try {
        localStorage.setItem(key, JSON.stringify(newCategories))
      } catch {}

      // Supabase 테이블이 있으면 백그라운드 동기화
      if (supabase && currentMemberId && familyId) {
        supabase
          .from('member_feed_preferences')
          .upsert({
            member_id: currentMemberId,
            family_id: familyId,
            categories: newCategories,
            updated_at: new Date().toISOString(),
          })
          .then(() => {})
          .catch(() => {})
      }
    },
    [currentMemberId, isChild, supabase, familyId]
  )

  // 뉴스 피드 데이터 로드 (일반 뉴스 카테고리 대상)
  const loadFeed = useCallback(async (cat) => {
    if (cat.type && cat.type !== 'news') return // 아이들 전용 카드는 별도 뉴스 API 불필요
    setFeeds((prev) => ({
      ...prev,
      [cat.id]: { loading: true, error: '', items: prev[cat.id]?.items || [] },
    }))
    try {
      const items = await fetchNews(cat.query || cat.label, ITEMS_PER_CATEGORY)
      setFeeds((prev) => ({ ...prev, [cat.id]: { loading: false, error: '', items } }))
    } catch (err) {
      setFeeds((prev) => ({ ...prev, [cat.id]: { loading: false, error: err.message, items: [] } }))
    }
  }, [])

  useEffect(() => {
    categories.forEach((cat) => {
      if (cat.type === 'news' || !cat.type) {
        setFeeds((prev) => {
          if (prev[cat.id]) return prev
          loadFeed(cat)
          return prev
        })
      }
    })
  }, [categories, loadFeed])

  // 새 카테고리 추가 (사용자 직접 입력)
  function addCategory(label) {
    const trimmed = label.trim()
    if (!trimmed) return
    const newCat = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'news',
      label: trimmed,
      icon: 'ph-newspaper',
      query: trimmed,
      items: [],
    }
    const next = [...categories, newCat]
    saveCategories(next)
  }

  // 추천 카테고리 칩 1탭 추가
  function addQuickPreset(preset) {
    // 이미 존재하는지 확인
    if (categories.some((c) => c.id === preset.id || (preset.type === 'news' && c.label === preset.label))) {
      return
    }
    const newCat = {
      id: preset.id.startsWith('c_') ? preset.id : `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: preset.type,
      label: preset.label.replace(/^[^\s]+\s/, ''), // 앞의 이모지 제거 후 깔끔한 라벨 사용
      icon: preset.icon || 'ph-sparkle',
      query: preset.query || preset.label,
      items: [],
    }
    // 아이들 카드는 고유 id 유지
    if (preset.type.startsWith('kid_')) {
      newCat.id = preset.id
    }
    const next = [...categories, newCat]
    saveCategories(next)
  }

  // 카테고리 삭제 (개인 맞춤 고정 반영)
  function removeCategory(catId) {
    const next = categories.filter((c) => c.id !== catId)
    saveCategories(next)
  }

  // 수동 항목 추가
  function addItem(catId, title) {
    const next = categories.map((c) =>
      c.id === catId
        ? {
            ...c,
            items: [
              ...(c.items || []),
              { id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title, source: '' },
            ],
          }
        : c
    )
    saveCategories(next)
  }

  // 수동 항목 삭제
  function removeItem(catId, itemId) {
    const next = categories.map((c) =>
      c.id === catId ? { ...c, items: (c.items || []).filter((i) => i.id !== itemId) } : c
    )
    saveCategories(next)
  }

  // 기본 카테고리로 초기화
  function resetToDefaults() {
    const defaults = isChild ? DEFAULT_KID_CATEGORIES : DEFAULT_ADULT_CATEGORIES
    saveCategories(defaults)
  }

  return (
    <>
      <div className="relative mb-6">
        <span
          className="absolute -top-2 left-0 w-12 h-5 bg-tape-blue/90 rotate-[-4deg] rounded-sm shadow-sm"
          aria-hidden="true"
        ></span>
        <div className="flex items-center justify-between">
          <h1 className="font-display font-extrabold text-[28px] leading-[34px]">오늘의 정보</h1>
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-[12px] font-bold text-foreground-muted hover:text-foreground underline decoration-border active:scale-95 transition"
          >
            기본 카테고리로 초기화
          </button>
        </div>

        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2 flex items-center gap-1.5">
          <span>{currentMember?.name ? `${currentMember.name}님의 맞춤 정보 피드예요.` : '관심 있는 소식만 골라 카테고리를 자유롭게 관리하세요.'}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {isChild ? '아이 맞춤 모드 🎒' : '부모 모드 👔'}
          </span>
        </p>

        <p className="text-foreground-muted text-[13px] leading-[19px] mt-1">
          카테고리를 추가하거나 삭제하면 <strong className="text-foreground">내 계정에 안전하게 고정 저장</strong>돼요.
        </p>
      </div>

      {/* 가로 스냅 스크롤 피드 카드 영역 */}
      {categories.length === 0 ? (
        <div className="bg-surface border-2 border-dashed border-border rounded-2xl p-8 text-center my-4">
          <p className="font-display font-bold text-[16px] text-foreground mb-1">
            등록된 카테고리가 없어요.
          </p>
          <p className="text-[13px] text-foreground-muted mb-4">
            아래 추천 카테고리나 새 카테고리를 추가해 보세요!
          </p>
          <button
            type="button"
            onClick={resetToDefaults}
            className="px-4 py-2 bg-secondary-dark text-on-secondary rounded-xl font-display font-bold text-[13px] shadow-xs active:scale-95 transition"
          >
            기본 추천 카테고리 불러오기
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {categories.map((cat, idx) => {
            // 2-1. 역사 속 오늘 카드
            if (cat.type === 'kid_history') {
              return (
                <TodayInHistoryCard
                  key={cat.id}
                  onRemove={() => removeCategory(cat.id)}
                />
              )
            }

            // 2-2. 과학 · 우주 한 줄 카드
            if (cat.type === 'kid_science') {
              return (
                <ScienceTriviaCard
                  key={cat.id}
                  onRemove={() => removeCategory(cat.id)}
                />
              )
            }

            // 2-3. 생각 질문 & 넌센스 퀴즈 카드 (생각 질문 우선 표시)
            if (cat.type === 'kid_quiz') {
              return (
                <QuizAndThoughtCard
                  key={cat.id}
                  onRemove={() => removeCategory(cat.id)}
                />
              )
            }

            // 2-4. 순우리말 · 고사성어 · 속담 카드
            if (cat.type === 'kid_korean' || cat.type === 'kid_word') {
              return (
                <KoreanWordsCard
                  key={cat.id}
                  onRemove={() => removeCategory(cat.id)}
                />
              )
            }

            // 2-5. 실생활 영어 표현 카드 (완전 분리된 독립 카드)
            if (cat.type === 'kid_english') {
              return (
                <EnglishWordCard
                  key={cat.id}
                  onRemove={() => removeCategory(cat.id)}
                />
              )
            }

            // 일반 뉴스 카테고리 카드
            const feed = feeds[cat.id] || { loading: true, error: '', items: [] }
            const manualItems = cat.items || []

            return (
              <div
                key={cat.id}
                className={`shrink-0 w-[min(300px,72vw)] snap-start flex flex-col justify-between ${
                  idx === 0
                    ? 'relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-card-padding'
                    : 'relative bg-surface border border-border rounded-2xl shadow-soft p-card-padding'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <i className={`ph-duotone ${cat.icon || 'ph-newspaper'} text-xl text-primary`}></i>
                      <span className="font-display font-bold text-[17px]">{cat.label}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadFeed(cat)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition duration-150 text-foreground-muted"
                        aria-label={`${cat.label} 새로고침`}
                        title="새로고침"
                      >
                        <i className="ph-bold ph-arrow-clockwise text-base"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCategory(cat.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-destructive/10 hover:text-destructive active:scale-90 transition duration-150 text-foreground-muted"
                        aria-label={`${cat.label} 카테고리 삭제`}
                        title="카테고리 삭제"
                      >
                        <i className="ph-bold ph-trash text-base"></i>
                      </button>
                    </span>
                  </div>

                  <div className="mb-3">
                    {feed.loading && (
                      <p className="text-[14px] text-foreground-muted py-2">소식을 불러오는 중...</p>
                    )}
                    {feed.error && (
                      <p className="text-[13px] text-foreground-muted py-2">{feed.error}</p>
                    )}
                    {feed.items.map((item) => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-2 py-2 border-t border-border first:border-t-0 active:opacity-60 transition duration-150"
                      >
                        <i className="ph-fill ph-circle text-[6px] text-primary mt-2 shrink-0"></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14.5px] leading-[21px] font-medium text-foreground line-clamp-2">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-foreground-muted mt-0.5">
                            {item.source}
                            {item.date ? ` · ${item.date}` : ''}
                          </p>
                        </div>
                        <i className="ph-bold ph-arrow-up-right text-xs text-foreground-muted mt-1 shrink-0"></i>
                      </a>
                    ))}
                    {manualItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 py-2 border-t border-border first:border-t-0"
                      >
                        <i className="ph-fill ph-circle text-[6px] text-foreground-muted mt-2 shrink-0"></i>
                        <div className="flex-1">
                          <p className="text-[14.5px] leading-[21px]">{item.title}</p>
                          {item.source && (
                            <p className="text-[11px] text-foreground-muted mt-0.5">{item.source}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(cat.id, item.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                          aria-label="소식 삭제"
                        >
                          <i className="ph-bold ph-x text-sm text-foreground-muted"></i>
                        </button>
                      </div>
                    ))}
                    {!feed.loading && !feed.error && feed.items.length === 0 && manualItems.length === 0 && (
                      <p className="text-[14px] text-foreground-muted py-2">관련된 소식을 찾지 못했어요.</p>
                    )}
                  </div>
                </div>

                <ItemAddForm onAdd={(title) => addItem(cat.id, title)} />
              </div>
            )
          })}
        </div>
      )}

      {/* 추천 카테고리 빠른 추가 칩 영역 */}
      <div className="mt-4 bg-surface border border-border rounded-xl p-3.5 shadow-soft">
        <p className="font-display font-bold text-[12.5px] text-foreground-muted mb-2 flex items-center gap-1.5">
          <i className="ph-bold ph-magic-wand text-primary"></i>
          <span>추천 카테고리 바로 추가하기 (클릭 시 피드에 추가)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RECOMMENDED_OPTIONS.map((opt) => {
            const alreadyAdded = categories.some(
              (c) => c.id === opt.id || (c.type === 'news' && c.label === opt.label.replace(/^[^\s]+\s/, ''))
            )
            return (
              <button
                key={opt.id}
                type="button"
                disabled={alreadyAdded}
                onClick={() => addQuickPreset(opt)}
                className={`text-[11.5px] font-display font-bold px-2.5 py-1.5 rounded-full border transition active:scale-95 flex items-center gap-1 ${
                  alreadyAdded
                    ? 'bg-surface-muted text-foreground-muted/60 border-border opacity-60 cursor-default'
                    : 'bg-surface hover:bg-surface-muted text-foreground border-foreground/30 shadow-xs'
                }`}
              >
                <span>{opt.label}</span>
                {alreadyAdded ? (
                  <i className="ph-bold ph-check text-[10px] text-success"></i>
                ) : (
                  <i className="ph-bold ph-plus text-[10px] text-primary"></i>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2-5. 새 카테고리 만들기 (사용자 직접 검색어 추가 유지) */}
      <div className="relative bg-surface-muted border-2 border-foreground rounded-xl shadow-sticker active:translate-x-0.5 active:translate-y-0.5 transition-all duration-150 px-4 py-4 mt-4 mb-6">
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3 flex items-center gap-1.5">
          <i className="ph-duotone ph-squares-four text-base text-primary"></i>
          <span>새 카테고리 만들기</span>
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const v = categoryInput.trim()
            if (!v) return
            addCategory(v)
            setCategoryInput('')
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="관심 키워드 입력 (예: 공룡, 우주 로봇, 동물, 레고, 날씨...)"
            className="flex-1 min-w-0 bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition font-medium"
            autoComplete="off"
          />
          <button
            type="submit"
            className="w-11 h-11 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150 shadow-xs"
            aria-label="카테고리 추가"
          >
            <i className="ph-bold ph-plus text-lg"></i>
          </button>
        </form>
      </div>

      <div className="flex-1"></div>
    </>
  )
}

export default InfoFeedScreen
