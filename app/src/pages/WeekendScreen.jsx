import { useState } from 'react'

// 더미 데이터 — Supabase 연결 전 하드코딩 (screens/js/store.js DEFAULTS와 동일)
// TourAPI 연동(js/tourapi.js)은 아직 React 쪽에 포팅하지 않음 — 프록시 없이 실 API 호출을 새로 연결하지 않기로 한 방침 유지
const INITIAL_ACTIVITIES = [
  { id: 'w1', title: '한강 불꽃 야시장', category: 'family', type: 'festival', region: '서울', date: '이번 주말', location: '여의도 한강공원' },
  { id: 'w2', title: '연극 <봄날의 곰을 좋아하세요?>', category: 'family', type: 'play', region: '서울', date: '상시', location: '대학로' },
  { id: 'w3', title: '어린이 과학관 체험전', category: 'family', type: 'sight', region: '경기', date: '이번 주말', location: '수원' },
  { id: 'w4', title: '청소년 진로박람회', category: 'student', type: 'sight', region: '서울', date: '토요일', location: 'coex' },
]

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'student', label: '초중고 학생' },
  { key: 'family', label: '가족' },
]

const TYPE_ICON = { festival: 'ph-confetti', sight: 'ph-binoculars', play: 'ph-ticket' }

const CATEGORY_STYLE = {
  student: { label: '초중고 학생', iconBg: 'bg-primary/10', iconText: 'text-primary', badgeBg: 'bg-primary', badgeText: 'text-on-primary' },
  family: { label: '가족', iconBg: 'bg-secondary/10', iconText: 'text-secondary', badgeBg: 'bg-secondary', badgeText: 'text-on-secondary' },
}

let nextId = 100

function WeekendScreen() {
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', category: 'family', type: 'festival', region: '', date: '', location: '' })

  const items = filter === 'all' ? activities : activities.filter((a) => a.category === filter)

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) return
    setActivities((prev) => [
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

  function removeActivity(id) {
    setActivities((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="relative mb-5">
        <span className="absolute -top-2 left-0 w-12 h-5 bg-tape-pink/90 rotate-[-4deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">주말에 뭐하지?</h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">우리 지역 축제·볼거리·공연을 골라봐요. 대상별로 자유롭게 추가·삭제할 수 있어요.</p>
      </div>

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
        {items.length === 0 ? (
          <p className="text-[14px] text-foreground-muted py-4 text-center">아직 등록된 나들이가 없어요. 아래에서 추가해보세요.</p>
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-start flex-wrap gap-2 mb-1">
                    <span className="font-display font-bold text-[16px] flex-1 min-w-[120px]">{a.title}</span>
                    <span className={`text-[11px] font-display font-bold px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText} shrink-0`}>{style.label}</span>
                  </div>
                  <p className="text-[13px] text-foreground-muted">
                    {a.region}
                    {a.location ? ` · ${a.location}` : ''} · {a.date}
                  </p>
                </div>
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
