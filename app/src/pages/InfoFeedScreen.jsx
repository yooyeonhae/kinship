import { useState } from 'react'

// 더미 데이터 — Supabase 연결 전 하드코딩 (screens/js/store.js DEFAULTS와 동일)
const INITIAL_CATEGORIES = [
  {
    id: 'c1', label: '경제 헤드라인', icon: 'ph-chart-line-up',
    items: [
      { id: 'i1', title: '기준금리 동결, 시장 반응은?', source: '경제신문' },
      { id: 'i2', title: '3분기 물가 상승률 둔화', source: '연합속보' },
    ],
  },
  {
    id: 'c2', label: '주식', icon: 'ph-trend-up',
    items: [
      { id: 'i3', title: '코스피 2,650선 마감', source: '증권시황' },
      { id: 'i4', title: '반도체株 강세 지속', source: '증권시황' },
    ],
  },
  {
    id: 'c3', label: '국가 혜택 · 정책', icon: 'ph-bank',
    items: [
      { id: 'i5', title: '아동수당 신청 기간 안내', source: '정부24' },
      { id: 'i6', title: '에너지바우처 신청 시작', source: '복지로' },
    ],
  },
  {
    id: 'c4', label: '스포츠', icon: 'ph-basketball',
    items: [{ id: 'i7', title: '프로야구 오늘 경기 일정', source: '스포츠뉴스' }],
  },
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

  function addCategory(label) {
    setCategories((prev) => [...prev, { id: `c${nextId++}`, label, icon: 'ph-newspaper', items: [] }])
  }

  function removeCategory(catId) {
    setCategories((prev) => prev.filter((c) => c.id !== catId))
  }

  function addItem(catId, title) {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, items: [...c.items, { id: `i${nextId++}`, title, source: '' }] } : c))
    )
  }

  function removeItem(catId, itemId) {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c))
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
        {categories.map((cat, idx) => (
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
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                aria-label={`${cat.label} 카테고리 삭제`}
              >
                <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
              </button>
            </div>
            <div className="mb-3">
              {cat.items.length === 0 ? (
                <p className="text-[14px] text-foreground-muted py-2">아직 등록된 소식이 없어요.</p>
              ) : (
                cat.items.map((item) => (
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
                ))
              )}
            </div>
            <ItemAddForm onAdd={(title) => addItem(cat.id, title)} />
          </div>
        ))}
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
