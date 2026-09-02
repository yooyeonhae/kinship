import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTourActivities, TOUR_REGIONS, TOUR_CONTENT_TYPES } from '../lib/tourapi'
import { useFamily } from '../context/FamilyContext'
import { DEFAULT_SETTINGS, SETTINGS_EVENT, loadSettings } from '../lib/settings'

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

const TYPE_ICON = { festival: 'ph-confetti', sight: 'ph-binoculars', play: 'ph-ticket', other: 'ph-star' }
const TYPE_LABEL = { festival: '축제', sight: '볼거리', play: '공연/연극', other: '기타' }

const CATEGORY_STYLE = {
  student: { label: '초중고 학생', iconBg: 'bg-primary/10', iconText: 'text-primary', badgeBg: 'bg-primary', badgeText: 'text-on-primary' },
  family: { label: '가족', iconBg: 'bg-secondary/10', iconText: 'text-secondary', badgeBg: 'bg-secondary', badgeText: 'text-on-secondary' },
}

// 위시리스트 카드에 작성자 배지 색상
const MEMBER_BADGE_COLORS = [
  'bg-tape-pink text-foreground',
  'bg-tape-yellow text-foreground',
  'bg-tape-blue text-foreground',
  'bg-primary/20 text-primary',
  'bg-secondary/20 text-secondary',
]

let nextId = 100

function WeekendScreen() {
  const [wishes, setWishes] = useState([]) // 가족 위시리스트 (앞에 추가)
  const [tourItems, setTourItems] = useState([])
  const [tourLoading, setTourLoading] = useState(true)
  const [tourError, setTourError] = useState('')
  // 처음 보이는 지역은 가족 설정에서 온다. 화면에서 바꾸면 이번만 바뀌고,
  // 늘 쓰는 지역은 설정에서 정한다.
  const { supabase, familyId, members, currentMemberId } = useFamily()
  const [region, setRegion] = useState(DEFAULT_SETTINGS.default_region)
  // 사람이 지역을 고른 뒤에는 설정값으로 되돌리지 않는다 — 보고 있던 지역이
  // 설정을 읽어오는 순간 튀면 "왜 바뀌지"가 된다.
  const pickedRef = useRef(false)
  const [contentTypeId, setContentTypeId] = useState('15')
  const [filter, setFilter] = useState('all')

  // 기본 작성자는 현재 로그인한 멤버
  const defaultAuthor = currentMemberId || (members[0]?.member_id ?? '')
  const [form, setForm] = useState({
    title: '',
    author: defaultAuthor,
    type: 'festival',
    region: '',
    date: '',
    location: '',
    memo: '',
  })

  // currentMemberId가 로드된 후 form.author 초기값 세팅
  useEffect(() => {
    if (currentMemberId && !form.author) {
      setForm((prev) => ({ ...prev, author: currentMemberId }))
    }
  }, [currentMemberId])

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

  // 기본 지역을 설정에서 읽어온다. 사람이 이미 고른 뒤라면 건드리지 않는다 —
  // 보고 있던 지역이 설정 응답이 도착하는 순간 튀면 "왜 바뀌지"가 된다.
  useEffect(() => {
    if (!familyId) return
    let alive = true
    const read = async () => {
      const res = await loadSettings(supabase)
      if (alive && !pickedRef.current) setRegion(res.data.default_region)
    }
    read()
    window.addEventListener(SETTINGS_EVENT, read)
    return () => {
      alive = false
      window.removeEventListener(SETTINGS_EVENT, read)
    }
  }, [supabase, familyId])

  useEffect(loadTour, [loadTour])

  const activities = [...tourItems]
  const items = filter === 'all' ? activities : activities.filter((a) => a.type === filter)

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleWishSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) return
    const authorMember = members.find((m) => m.member_id === form.author)
    // 새로 추가된 항목은 제일 앞(위)에 쌓인다
    setWishes((prev) => [
      {
        id: `w${nextId++}`,
        title,
        authorId: form.author,
        authorName: authorMember?.name || '가족',
        authorAvatar: authorMember?.avatar || null,
        type: form.type,
        region: form.region.trim() || '',
        date: form.date.trim() || '',
        location: form.location.trim(),
        memo: form.memo.trim(),
        addedAt: new Date().toISOString(),
      },
      ...prev,
    ])
    setForm((prev) => ({
      title: '',
      author: prev.author, // 작성자는 유지
      type: 'festival',
      region: '',
      date: '',
      location: '',
      memo: '',
    }))
  }

  function removeWish(id) {
    setWishes((prev) => prev.filter((w) => w.id !== id))
  }

  // 관광공사에서 받아온 항목은 원본을 지울 수 없으니 목록에서만 감춘다.
  function removeTourItem(id) {
    setTourItems((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="relative mb-5">
        <span className="absolute -top-2 left-0 w-12 h-5 bg-tape-pink/90 rotate-[-4deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">주말에 뭐하지?</h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">우리 가족이 가고 싶은 곳을 모아봐요!</p>
      </div>

      {/* ── 가족 위시리스트 ── */}
      {wishes.length > 0 && (
        <section className="mb-6">
          <p className="font-display font-bold text-[14px] flex items-center gap-1.5 mb-3">
            <i className="ph-fill ph-heart text-base text-tape-pink" aria-hidden="true"></i>
            우리 가족 가고 싶은 곳 {wishes.length}곳
          </p>
          <div className="flex flex-col gap-3">
            {wishes.map((w, idx) => {
              const badgeColor = MEMBER_BADGE_COLORS[idx % MEMBER_BADGE_COLORS.length]
              const typeIcon = TYPE_ICON[w.type] || 'ph-star'
              return (
                <div
                  key={w.id}
                  className="bg-surface border-2 border-foreground rounded-lg shadow-sticker px-4 py-4 flex items-start gap-3"
                >
                  <span className="w-11 h-11 rounded-full bg-tape-pink/15 flex items-center justify-center shrink-0">
                    <i className={`ph-duotone ${typeIcon} text-xl text-tape-pink`}></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-wrap gap-2 mb-1">
                      <span className="font-display font-bold text-[16px] flex-1 min-w-[100px]">{w.title}</span>
                      <span className={`text-[11px] font-display font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
                        {w.authorName}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-1 text-[12px] bg-surface-muted rounded-full px-2 py-0.5 font-display font-bold">
                        <i className={`ph-bold ${typeIcon} text-xs`}></i>
                        {TYPE_LABEL[w.type] || w.type}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground-muted">
                      {[w.region, w.location, w.date].filter(Boolean).join(' · ')}
                    </p>
                    {w.memo && (
                      <p className="text-[12px] text-foreground-muted mt-1 italic">"{w.memo}"</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWish(w.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                    aria-label={`${w.title} 삭제`}
                  >
                    <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 가고싶은 곳 추가 폼 ── */}
      <div className="relative bg-surface border-2 border-foreground rounded-lg shadow-sticker px-4 py-4 mb-6">
        <p className="font-display font-bold text-[14px] tracking-wide mb-3 flex items-center gap-1.5">
          <i className="ph-fill ph-heart text-base text-tape-pink"></i>
          가고 싶은 곳 추가하기
        </p>
        <form onSubmit={handleWishSubmit} className="flex flex-col gap-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="장소 이름 (예: 벚꽃 축제, 롯데월드)"
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            {/* 누가 가고 싶다고 했는지 */}
            <select
              value={form.author}
              onChange={(e) => updateForm('author', e.target.value)}
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
              aria-label="작성자"
            >
              {members.length > 0
                ? members.map((m) => (
                    <option key={m.member_id} value={m.member_id}>
                      {m.name}
                    </option>
                  ))
                : <option value="">가족 선택</option>
              }
            </select>
            {/* 종류 — 기타 추가 */}
            <select
              value={form.type}
              onChange={(e) => updateForm('type', e.target.value)}
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
              aria-label="종류"
            >
              <option value="festival">🎉 축제</option>
              <option value="sight">🔭 볼거리</option>
              <option value="play">🎭 공연/연극</option>
              <option value="other">✨ 기타</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.region}
              onChange={(e) => updateForm('region', e.target.value)}
              placeholder="지역 (예: 서울)"
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
            <input
              type="text"
              value={form.date}
              onChange={(e) => updateForm('date', e.target.value)}
              placeholder="시기 (예: 이번 달)"
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
          </div>
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateForm('location', e.target.value)}
            placeholder="장소·주소 (선택)"
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
          />
          <input
            type="text"
            value={form.memo}
            onChange={(e) => updateForm('memo', e.target.value)}
            placeholder="한마디 메모 (선택, 예: 꼭 가보고 싶어요!)"
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
          />
          <button
            type="submit"
            className="mt-1 bg-tape-pink/80 border-2 border-foreground text-foreground rounded-md py-3 flex items-center justify-center gap-2 font-display font-bold text-[15px] shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150"
          >
            <i className="ph-fill ph-heart"></i>추가하기
          </button>
        </form>
      </div>

      {/* ── 구분선 ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border"></div>
        <p className="text-[12px] font-display font-bold text-foreground-muted">우리 지역 축제·볼거리</p>
        <div className="flex-1 h-px bg-border"></div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <select
          value={region}
          onChange={(e) => {
            pickedRef.current = true
            setRegion(e.target.value)
          }}
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
              ? '이 지역의 관광 정보가 없어요.'
              : `${FILTERS.find((f) => f.key === filter)?.label} 항목이 없어요. 다른 종류를 눌러보세요.`}
          </p>
        ) : (
          items.map((a) => {
            const style = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.family
            return (
              <div
                key={a.id}
                className="bg-surface border border-border rounded-lg shadow-soft px-4 py-4 flex items-start gap-3"
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
                  onClick={() => removeTourItem(a.id)}
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

      <div className="flex-1"></div>
    </>
  )
}

export default WeekendScreen
