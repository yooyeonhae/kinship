import { useCallback, useEffect, useState } from 'react'
import { fetchNews } from '../lib/news'

// 카테고리 라벨이 곧 네이버 뉴스 검색어다. 기본 4개만 검색어를 따로 두는 이유는
// 라벨을 그대로 쓰면 결과가 나빠지기 때문이다 — 예를 들어 '국가 혜택·정책'은
// 검색어로서 거의 안 맞고, '아동수당'/'정부지원금'은 강력범죄 기사가 상단을 덮는다.
const INITIAL_CATEGORIES = [
  { id: 'c1', label: '경제 헤드라인', icon: 'ph-chart-line-up', query: '경제' },
  { id: 'c2', label: '주식', icon: 'ph-trend-up', query: '코스피' },
  { id: 'c3', label: '국가 혜택 · 정책', icon: 'ph-bank', query: '육아 지원 정책' },
  { id: 'c4', label: '스포츠', icon: 'ph-basketball', query: '프로야구' },
]

let nextId = 100

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
        className="flex-1 bg-surface-muted rounded-md px-3 py-2 text-[14px] border border-border outline-none"
        autoComplete="off"
      />
      <button type="submit" className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150" aria-label="소식 추가">
        <i className="ph-bold ph-plus text-base"></i>
      </button>
    </form>
  )
}

function InfoFeedScreen() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES)
  const [categoryInput, setCategoryInput] = useState('')
  // 카테고리별 뉴스는 따로 담는다. 사용자가 손으로 추가한 항목(items)과 섞으면
  // 새로고침 때 손으로 넣은 게 같이 날아간다.
  const [feeds, setFeeds] = useState({})

  const loadFeed = useCallback(async (cat) => {
    setFeeds((prev) => ({ ...prev, [cat.id]: { loading: true, error: '', items: prev[cat.id]?.items || [] } }))
    try {
      const items = await fetchNews(cat.query || cat.label)
      setFeeds((prev) => ({ ...prev, [cat.id]: { loading: false, error: '', items } }))
    } catch (err) {
      setFeeds((prev) => ({ ...prev, [cat.id]: { loading: false, error: err.message, items: [] } }))
    }
  }, [])

  useEffect(() => {
    categories.forEach((cat) => {
      setFeeds((prev) => {
        if (prev[cat.id]) return prev
        loadFeed(cat)
        return prev
      })
    })
  }, [categories, loadFeed])

  function addCategory(label) {
    setCategories((prev) => [...prev, { id: `c${nextId++}`, label, icon: 'ph-newspaper', query: label, items: [] }])
  }

  function removeCategory(catId) {
    setCategories((prev) => prev.filter((c) => c.id !== catId))
  }

  function addItem(catId, title) {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, items: [...(c.items || []), { id: `i${nextId++}`, title, source: '' }] } : c))
    )
  }

  function removeItem(catId, itemId) {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, items: (c.items || []).filter((i) => i.id !== itemId) } : c))
    )
  }

  return (
    <>
      <div className="relative mb-6">
        <span className="absolute -top-2 left-0 w-12 h-5 bg-tape-blue/90 rotate-[-4deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">오늘의 정보</h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">관심 있는 소식만 골라 카테고리를 자유롭게 추가·삭제할 수 있어요.</p>
      </div>

      <div className="flex flex-col gap-5">
        {categories.map((cat, idx) => {
          const feed = feeds[cat.id] || { loading: true, error: '', items: [] }
          const manualItems = cat.items || []
          return (
          <div
            key={cat.id}
            className={
              idx === 0
                ? 'relative bg-surface border-2 border-foreground rounded-md shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 p-card-padding'
                : 'relative bg-surface border border-border rounded-lg shadow-soft p-card-padding'
            }
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <i className={`ph-duotone ${cat.icon} text-xl text-primary`}></i>
                <span className="font-display font-bold text-[17px]">{cat.label}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => loadFeed(cat)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
                  aria-label={`${cat.label} 새로고침`}
                >
                  <i className="ph-bold ph-arrow-clockwise text-base text-foreground-muted"></i>
                </button>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
                  aria-label={`${cat.label} 카테고리 삭제`}
                >
                  <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
                </button>
              </span>
            </div>
            <div className="mb-3">
              {feed.loading && <p className="text-[14px] text-foreground-muted py-2">소식을 불러오는 중...</p>}
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
                    <p className="text-[15px] leading-[22px]">{item.title}</p>
                    <p className="text-[12px] text-foreground-muted mt-0.5">
                      {item.source}
                      {item.date ? ` · ${item.date}` : ''}
                    </p>
                  </div>
                  <i className="ph-bold ph-arrow-up-right text-sm text-foreground-muted mt-1 shrink-0"></i>
                </a>
              ))}
              {manualItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2 py-2 border-t border-border first:border-t-0">
                  <i className="ph-fill ph-circle text-[6px] text-foreground-muted mt-2 shrink-0"></i>
                  <div className="flex-1">
                    <p className="text-[15px] leading-[22px]">{item.title}</p>
                    {item.source && <p className="text-[12px] text-foreground-muted mt-0.5">{item.source}</p>}
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
            <ItemAddForm onAdd={(title) => addItem(cat.id, title)} />
          </div>
          )
        })}
      </div>

      <div className="relative bg-surface-muted border-2 border-foreground rounded-md shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 px-4 py-4 mt-6">
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3 flex items-center gap-1.5">
          <i className="ph-duotone ph-squares-four text-base"></i>새 카테고리 만들기
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
            placeholder="예: 날씨, 부동산, IT 뉴스"
            className="flex-1 bg-surface rounded-md px-3 py-2.5 text-[15px] border border-border outline-none"
            autoComplete="off"
          />
          <button type="submit" className="w-11 h-11 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150" aria-label="카테고리 추가">
            <i className="ph-bold ph-plus text-lg"></i>
          </button>
        </form>
      </div>

      <div className="flex-1"></div>
    </>
  )
}

export default InfoFeedScreen
