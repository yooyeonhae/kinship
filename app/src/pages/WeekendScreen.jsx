import { useCallback, useEffect, useState } from 'react'
import { fetchTourActivities, TOUR_REGIONS, TOUR_CONTENT_TYPES } from '../lib/tourapi'

// 예전 필터는 '초중고 학생' / '가족'이었는데, TourAPI가 대상 연령을 구분해주지 않아
// 불러온 항목이 전부 'family'로 들어온다. 그래서 '초중고 학생'을 누르면 결과가 늘 0건이고
// 새 나들이 추가 폼만 남았다. 데이터가 실제로 갖고 있는 값(종류)으로 거른다.
const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'festival', label: '축제·행사' },
  { key: 'sight', label: '관광지' },
  { key: 'culture', label: '문화시설' },
]

// 축제 이름만 검색하면 동명의 다른 지역 행사가 섞인다. 지역을 함께 넣어 좁힌다.
function naverSearchUrl(activity) {
  const query = [activity.title, activity.region].filter(Boolean).join(' ')
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`
}

const TYPE_ICON = { festival: 'ph-confetti', sight: 'ph-binoculars', play: 'ph-ticket' }

const CATEGORY_STYLE = {
  student: { label: '초중고 학생', iconBg: 'bg-primary/10', iconText: 'text-primary', badgeBg: 'bg-primary', badgeText: 'text-on-primary' },
  family: { label: '가족', iconBg: 'bg-secondary/10', iconText: 'text-secondary', badgeBg: 'bg-secondary', badgeText: 'text-on-secondary' },
}

let nextId = 100

function WeekendScreen() {
  const [manual, setManual] = useState([])
  const [tourItems, setTourItems] = useState([])
  const [tourLoading, setTourLoading] = useState(true)
  const [tourError, setTourError] = useState('')
  const [region, setRegion] = useState('서울')
  const [contentTypeId, setContentTypeId] = useState('15')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', category: 'family', type: 'festival', region: '', date: '', location: '' })

  const loadTour = useCallback(() => {
    let alive = true
    setTourLoading(true)
    setTourError('')
    fetchTourActivities({ region, contentTypeId })
      .then((list) => {
        if (!alive) return
        setTourItems(list)
        setTourLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setTourError(err.message)
        setTourItems([])
        setTourLoading(false)
      })
    return () => {
      alive = false
    }
  }, [region, contentTypeId])

  useEffect(loadTour, [loadTour])

  const activities = [...tourItems, ...manual]
  const items = filter === 'all' ? activities : activities.filter((a) => a.type === filter)

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) return
    setManual((prev) => [
      ...prev,
      {
        id: `w${nextId++}`,
        title,
        category: form.category,
        type: form.type,
        region: form.region.trim() || '서울',
        date: form.date.trim() || '이번 주말',
        location: form.location.trim(),
      },
    ])
    setForm({ title: '', category: 'family', type: 'festival', region: '', date: '', location: '' })
  }

  // 관광공사에서 받아온 항목은 원본을 지울 수 없으니 목록에서만 감춘다.
  function removeActivity(id) {
    setManual((prev) => prev.filter((a) => a.id !== id))
    setTourItems((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="relative mb-5">
        <span className="absolute -top-2 left-0 w-12 h-5 bg-tape-pink/90 rotate-[-4deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">주말에 뭐하지?</h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">우리 지역 축제·볼거리·공연을 골라봐요. 대상별로 자유롭게 추가·삭제할 수 있어요.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="bg-surface rounded-md px-3 py-2.5 text-[14px] font-display font-bold border border-border outline-none"
          aria-label="지역 선택"
        >
          {TOUR_REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={contentTypeId}
          onChange={(e) => setContentTypeId(e.target.value)}
          className="bg-surface rounded-md px-3 py-2.5 text-[14px] font-display font-bold border border-border outline-none"
          aria-label="종류 선택"
        >
          {TOUR_CONTENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {tourError && (
        <div className="bg-surface-muted border border-border rounded-lg px-4 py-3 mb-4">
          <p className="text-[13px] text-foreground-muted">{tourError}</p>
          <button
            type="button"
            onClick={loadTour}
            className="mt-2 text-[13px] font-display font-bold text-primary active:scale-95 transition duration-150"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            data-active={filter === f.key}
            className="filter-chip bg-surface border border-border rounded-full px-4 py-2 text-[14px] font-display font-bold transition duration-150"
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {tourLoading ? (
          <p className="text-[14px] text-foreground-muted py-4 text-center">{region} 관광 정보를 불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-[14px] text-foreground-muted py-4 text-center">
            {filter === 'all'
              ? '아직 등록된 나들이가 없어요. 아래에서 추가해보세요.'
              : `${FILTERS.find((f) => f.key === filter)?.label} 항목이 없어요. 다른 종류를 눌러보세요.`}
          </p>
        ) : (
          items.map((a, i) => {
            const style = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.family
            return (
              <div
                key={a.id}
                className={
                  i === 0
                    ? 'bg-surface border-2 border-foreground rounded-md shadow-sticker rotate-[-1deg] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 px-4 py-4 flex items-start gap-3'
                    : 'bg-surface border border-border rounded-lg shadow-soft px-4 py-4 flex items-start gap-3'
                }
              >
                <span className={`w-11 h-11 rounded-full ${style.iconBg} flex items-center justify-center shrink-0`}>
                  <i className={`ph-duotone ${TYPE_ICON[a.type] || 'ph-confetti'} text-xl ${style.iconText}`}></i>
                </span>
                {/* TourAPI는 축제 상세 URL을 주지 않는다. 이름만으로 찾아보게 하는 게
                    가장 확실해서, 지역을 붙인 검색어로 네이버에 넘긴다. */}
                <a
                  href={naverSearchUrl(a)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 active:scale-[0.99] transition duration-150"
                >
                  <div className="flex items-start flex-wrap gap-2 mb-1">
                    <span className="font-display font-bold text-[16px] flex-1 min-w-[120px]">{a.title}</span>
                    <span className={`text-[11px] font-display font-bold px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText} shrink-0`}>{style.label}</span>
                  </div>
                  <p className="text-[13px] text-foreground-muted">
                    {a.region}
                    {a.location ? ` · ${a.location}` : ''} · {a.date}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[12px] font-display font-bold text-primary mt-1.5">
                    <i className="ph-bold ph-magnifying-glass text-xs"></i>네이버에서 자세히 보기
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => removeActivity(a.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                  aria-label={`${a.title} 삭제`}
                >
                  <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="relative bg-surface-muted border border-border rounded-lg px-4 py-4 mt-6">
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3 flex items-center gap-1.5">
          <i className="ph-duotone ph-map-pin-plus text-base"></i>새 나들이 추가하기
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="이름 (예: 벚꽃 축제)"
            className="bg-surface rounded-md px-3 py-2.5 text-[15px] border border-border outline-none"
            autoComplete="off"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none">
              <option value="family">가족</option>
              <option value="student">초중고 학생</option>
            </select>
            <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none">
              <option value="festival">축제</option>
              <option value="sight">볼거리</option>
              <option value="play">공연/연극</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.region}
              onChange={(e) => updateForm('region', e.target.value)}
              placeholder="지역 (예: 서울)"
              className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none"
              autoComplete="off"
            />
            <input
              type="text"
              value={form.date}
              onChange={(e) => updateForm('date', e.target.value)}
              placeholder="시기 (예: 이번 주말)"
              className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none"
              autoComplete="off"
            />
          </div>
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateForm('location', e.target.value)}
            placeholder="장소 (선택)"
            className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none"
            autoComplete="off"
          />
          <button type="submit" className="mt-1 bg-secondary-dark text-on-secondary rounded-md py-3 flex items-center justify-center gap-2 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150">
            <i className="ph-bold ph-plus"></i>추가하기
          </button>
        </form>
      </div>

      <div className="flex-1"></div>
    </>
  )
}

export default WeekendScreen
