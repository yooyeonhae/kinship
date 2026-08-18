import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

// 날씨는 이번 연동 범위 밖 — 실제 기상청 API 연동 전 임시 데이터
const WEATHER = {
  dateLabel: '10월 27일',
  tempC: 22,
  description: '맑음',
  sourceNote: '실제 기상청 API 연동 전 · 임시 데이터',
}

// schema.sql의 day_of_week CHECK 제약과 같은 값('월'..'일')
const DAY_CHARS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function todayInfo() {
  const idx = new Date().getDay()
  return { char: DAY_CHARS[idx], label: DAY_LABELS[idx] }
}

function OutfitCard({ label, icon, rotate, offset }) {
  return (
    <div
      className={`relative bg-surface rounded-md shadow-soft p-2 pb-3 w-28 shrink-0 flex flex-col items-center gap-2 item-pop-in ${rotate} ${offset}`}
    >
      <div className="w-full aspect-square rounded-sm bg-surface-muted flex items-center justify-center">
        <i className={`ph-duotone ${icon} text-4xl text-foreground-muted`} aria-hidden="true"></i>
      </div>
      <span className="font-display font-bold text-[13px] text-foreground text-center">{label}</span>
    </div>
  )
}

function ChildOutfitScreen() {
  const { memberId } = useParams()
  const { supabase, familyId, members } = useFamily()
  const childName = members.find((m) => m.member_id === memberId)?.name || '아이'
  const today = todayInfo()

  const [outfitType, setOutfitType] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const reqIdRef = useRef(0)

  const loadRule = useCallback(async () => {
    if (!familyId || !memberId) return
    const myReq = ++reqIdRef.current
    setLoading(true)
    setErrorMsg('')
    const { data, error } = await supabase
      .from('weekly_outfit_rules')
      .select('outfit_type')
      .eq('member_id', memberId)
      .eq('day_of_week', today.char)
      .maybeSingle()
    if (myReq !== reqIdRef.current) return
    if (error) {
      setErrorMsg('지정복을 불러오지 못했어요.')
      setLoading(false)
      return
    }
    setOutfitType(data?.outfit_type || null)
    setLoading(false)
  }, [supabase, familyId, memberId, today.char])

  useEffect(() => {
    loadRule()
  }, [loadRule])

  const outfitItems = outfitType
    ? [
        { label: outfitType, icon: 'ph-shirt-folded', rotate: '-rotate-3', offset: '-translate-y-1' },
        { label: '겉옷', icon: 'ph-jacket', rotate: 'rotate-3', offset: 'translate-y-2' },
      ]
    : []

  return (
    <>
      <div className="bg-surface-muted rounded-lg p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-bold text-[19px] leading-snug">오늘 날씨 · {WEATHER.dateLabel}</p>
          <p className="text-[15px] text-foreground-muted mt-1">{WEATHER.tempC}°C</p>
          <p className="text-[11px] text-foreground-muted/70 mt-2">{WEATHER.sourceNote}</p>
        </div>
        <div className="text-center shrink-0">
          <i className="ph-duotone ph-cloud-sun text-5xl text-primary icon-sway" aria-hidden="true"></i>
          <p className="text-[13px] font-display font-bold text-foreground-muted mt-1">{WEATHER.description}</p>
        </div>
      </div>

      <p className="mb-3">
        <span className="font-display font-bold text-[15px] text-foreground bg-tape-yellow/70 px-1 -rotate-1 inline-block">
          오늘의 지정복
        </span>
      </p>
      <div className="relative bg-accent border-2 border-foreground rounded-md shadow-sticker p-6 mb-6 overflow-visible">
        <i className="ph-fill ph-person-simple-run absolute -top-3 -right-2 text-2xl text-primary rotate-[-8deg]" aria-hidden="true"></i>
        <i className="ph-fill ph-soccer-ball absolute -bottom-3 -left-2 text-2xl text-foreground" aria-hidden="true"></i>
        <p className="font-display font-bold text-[19px] leading-snug text-center text-on-accent">
          {loading
            ? '오늘의 지정복을 확인하고 있어요...'
            : outfitType
              ? `오늘은 ${today.label} — ${outfitType} 입는 날이에요`
              : `오늘(${today.label})은 아직 지정된 옷차림이 없어요`}
        </p>
        {errorMsg && <p className="text-[12px] text-center text-on-accent/80 mt-2">{errorMsg}</p>}
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-full bg-surface-muted ring-4 ring-surface shadow-soft flex items-center justify-center">
            <i className="ph-duotone ph-shirt-folded text-3xl text-secondary" aria-hidden="true"></i>
          </div>
          <div className="w-16 h-16 rounded-full bg-surface-muted ring-4 ring-surface shadow-soft flex items-center justify-center">
            <i className="ph-duotone ph-pants text-3xl text-primary" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <p className="font-display font-bold text-[17px] text-secondary mb-1 relative inline-block">
          추천 옷차림
          <svg className="absolute left-0 -bottom-1 w-full h-2 pointer-events-none" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2,6 C20,2 35,9 50,5 C65,1 80,8 98,4" fill="none" stroke="#0055FF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </p>
        <div className="relative pt-6 pb-2">
          <i className="ph-fill ph-sparkle absolute top-2 left-4 text-xl text-tape-pink rotate-[-8deg]" aria-hidden="true"></i>
          <i className="ph-duotone ph-shirt-folded absolute bottom-0 right-8 text-lg text-primary rotate-[10deg]" aria-hidden="true"></i>

          {outfitType ? (
            <>
              <div className="flex items-start justify-center gap-4 flex-wrap pt-6 pb-2">
                {outfitItems.map((item) => (
                  <OutfitCard key={item.label} {...item} />
                ))}
              </div>
              <p className="font-display font-bold text-[17px] mb-1 text-center mt-4">{childName}, 오늘은 이렇게 입어요!</p>
              <p className="text-[15px] text-foreground-muted leading-[22px] text-center px-2">
                {outfitType} 위에 겉옷을 챙기면 아침저녁 쌀쌀한 날씨에도 든든해요.
              </p>
            </>
          ) : (
            !loading && (
              <p className="text-[15px] text-foreground-muted leading-[22px] text-center px-2 py-4">
                부모님이 {today.label} 옷차림을 정해주시면 여기에 보여드릴게요.
              </p>
            )
          )}
        </div>
      </div>

      <Link
        to={`/child-todo/${memberId}`}
        className="mt-6 bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
      >
        확인했어요!
        <i className="ph-bold ph-arrow-right text-lg" aria-hidden="true"></i>
      </Link>
    </>
  )
}

export default ChildOutfitScreen
