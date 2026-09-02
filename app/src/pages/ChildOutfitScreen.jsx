import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { fetchWeather, buildRecommendation } from '../lib/weather'
import { DEFAULT_SETTINGS, SETTINGS_EVENT, loadSettings } from '../lib/settings'
import { fetchWardrobeItems } from '../lib/wardrobe'

// schema.sql의 day_of_week CHECK 제약과 같은 값('월'..'일')
const DAY_CHARS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// ── 지정복 타입별 이모지 매핑 ──
const OUTFIT_META = [
  { key: '체육복', topEmoji: '🏃', bottomEmoji: '🩳', note: '체육복' },
  { key: '운동복', topEmoji: '🏃', bottomEmoji: '🩳', note: '운동복' },
  { key: '반팔',   topEmoji: '👕', bottomEmoji: '👖', note: '반팔' },
  { key: '긴팔',   topEmoji: '👔', bottomEmoji: '👖', note: '긴팔' },
  { key: '반소매', topEmoji: '👕', bottomEmoji: '👖', note: '반소매' },
  { key: '긴소매', topEmoji: '👔', bottomEmoji: '👖', note: '긴소매' },
  { key: '교복',   topEmoji: '🎒', bottomEmoji: '👔', note: '교복' },
  { key: '유니폼', topEmoji: '🎽', bottomEmoji: '👖', note: '유니폼' },
  { key: '정장',   topEmoji: '👔', bottomEmoji: '👔', note: '정장' },
  { key: '원피스', topEmoji: '👗', bottomEmoji: '👗', note: '원피스' },
  { key: '치마',   topEmoji: '👕', bottomEmoji: '👗', note: '치마' },
  { key: '바람막이', topEmoji: '🧥', bottomEmoji: '👖', note: '바람막이' },
  { key: '점퍼',   topEmoji: '🧥', bottomEmoji: '👖', note: '점퍼' },
  { key: '가디건', topEmoji: '🧶', bottomEmoji: '👖', note: '가디건' },
  { key: '코트',   topEmoji: '🧥', bottomEmoji: '👖', note: '코트' },
  { key: '패딩',   topEmoji: '❄️', bottomEmoji: '👖', note: '패딩' },
]

// 추천 여벌옷 이모지
const EXTRA_EMOJI = {
  '우비':       { emoji: '🌂', icon: 'ph-coat-hanger' },
  '겉옷':       { emoji: '🧥', icon: 'ph-jacket' },
  '얇은 여벌옷': { emoji: '👕', icon: 'ph-t-shirt' },
  '바람막이':   { emoji: '🧥', icon: 'ph-jacket' },
}

function getOutfitMeta(type) {
  if (!type) return null
  const t = type.trim()
  return OUTFIT_META.find((m) => t.includes(m.key)) || null
}

function todayInfo() {
  const idx = new Date().getDay()
  return { char: DAY_CHARS[idx], label: DAY_LABELS[idx] }
}

// ── 추천 옷차림 카드 (실제 옷 사진 우선 노출, 없으면 이모지 노출) ──
function OutfitCard({ label, emoji, imageUrl, rotate, offset }) {
  return (
    <div
      className={`relative bg-surface rounded-xl shadow-sticker border-2 border-foreground p-2 pb-3 w-28 shrink-0 flex flex-col items-center gap-2 item-pop-in ${rotate} ${offset}`}
    >
      <div className="w-full aspect-square rounded-lg bg-surface-muted overflow-hidden flex items-center justify-center border border-border">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl" aria-hidden="true">{emoji || '👕'}</span>
        )}
      </div>
      <span className="font-display font-bold text-[13px] text-foreground text-center truncate w-full px-1">
        {label}
      </span>
    </div>
  )
}

function ChildOutfitScreen() {
  const { memberId } = useParams()
  const { supabase, familyId, members } = useFamily()
  const childName = members.find((m) => m.member_id === memberId)?.name || '아이'
  const today = todayInfo()

  const [outfitType, setOutfitType] = useState(null)
  const [wardrobe, setWardrobe] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [region, setRegion] = useState(DEFAULT_SETTINGS.default_region)

  const reqIdRef = useRef(0)

  // 지정복 및 옷장 데이터 로드
  const loadData = useCallback(async () => {
    if (!familyId || !memberId) return
    const myReq = ++reqIdRef.current
    setLoading(true)
    setErrorMsg('')

    try {
      const [ruleRes, wardrobeItems] = await Promise.all([
        supabase
          .from('weekly_outfit_rules')
          .select('outfit_type')
          .eq('member_id', memberId)
          .eq('day_of_week', today.char)
          .maybeSingle(),
        fetchWardrobeItems(supabase, familyId, memberId),
      ])

      if (myReq !== reqIdRef.current) return
      if (ruleRes.error) {
        setErrorMsg('지정복을 불러오지 못했어요.')
      } else {
        setOutfitType(ruleRes.data?.outfit_type || null)
      }
      setWardrobe(wardrobeItems || [])
    } catch (err) {
      if (myReq === reqIdRef.current) {
        setErrorMsg('데이터를 불러오지 못했어요.')
      }
    } finally {
      if (myReq === reqIdRef.current) {
        setLoading(false)
      }
    }
  }, [supabase, familyId, memberId, today.char])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!familyId) return
    let alive = true
    const read = async () => {
      const res = await loadSettings(supabase)
      if (alive) setRegion(res.data.default_region)
    }
    read()
    window.addEventListener(SETTINGS_EVENT, read)
    return () => {
      alive = false
      window.removeEventListener(SETTINGS_EVENT, read)
    }
  }, [supabase, familyId])

  useEffect(() => {
    let alive = true
    fetchWeather(region)
      .then((data) => { if (alive) setWeather(data) })
      .catch((err) => { if (alive) setWeatherError(err.message) })
    return () => { alive = false }
  }, [region])

  const recommendation = outfitType && weather ? buildRecommendation(outfitType, weather) : null
  const meta = getOutfitMeta(outfitType)

  // 옷장에서 특정 키워드에 매칭되는 실제 옷 사진 찾기
  function findPhotoFor(typeLabel) {
    if (!typeLabel || !wardrobe.length) return null
    const t = typeLabel.trim().toLowerCase()
    const found = wardrobe.find((item) => {
      const cType = (item.clothing_type || '').toLowerCase()
      const cName = (item.custom_name || '').toLowerCase()
      const cat = (item.category || '').toLowerCase()
      return (
        cType.includes(t) ||
        t.includes(cType) ||
        cName.includes(t) ||
        t.includes(cName) ||
        cat.includes(t)
      )
    })
    return found?.public_url || null
  }

  // 추천 옷차림 카드 목록 — 지정복 + 날씨 여벌옷(있을 때)
  const outfitItems = outfitType
    ? [
        {
          label: outfitType,
          emoji: meta?.topEmoji || '👕',
          imageUrl: findPhotoFor(outfitType),
          rotate: '-rotate-3',
          offset: '-translate-y-1',
        },
        ...(recommendation?.extra
          ? [{
              label: recommendation.extra.name,
              emoji: (EXTRA_EMOJI[recommendation.extra.name] || {}).emoji || '🧥',
              imageUrl: findPhotoFor(recommendation.extra.name),
              rotate: 'rotate-3',
              offset: 'translate-y-2',
            }]
          : []),
      ]
    : []

  return (
    <>
      {/* 날씨 카드 */}
      <div className="bg-surface-muted rounded-lg p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-bold text-[19px] leading-snug">
            오늘 날씨{weather ? ` · ${weather.dateLabel}` : ''}
          </p>
          {weather ? (
            <>
              <p className="text-[15px] text-foreground-muted mt-1">
                {weather.tempC}°C
                {weather.minTempC !== null && weather.maxTempC !== null
                  ? ` (${weather.minTempC}° / ${weather.maxTempC}°)`
                  : ''}
              </p>
              <p className="text-[11px] text-foreground-muted/70 mt-2">
                {weather.region} · OpenWeatherMap
                {weather.rainProb !== null ? ` · 강수확률 ${weather.rainProb}%` : ''}
              </p>
            </>
          ) : (
            <p className="text-[15px] text-foreground-muted mt-1">
              {weatherError || '날씨를 불러오는 중...'}
            </p>
          )}
        </div>
        <div className="text-center shrink-0">
          <i
            className={`ph-duotone ${weather?.icon || 'ph-cloud-sun'} text-5xl text-primary icon-sway`}
            aria-hidden="true"
          ></i>
          <p className="text-[13px] font-display font-bold text-foreground-muted mt-1">
            {weather?.description || '—'}
          </p>
        </div>
      </div>

      {/* 오늘의 지정복 카드 */}
      <p className="mb-3">
        <span className="font-display font-bold text-[15px] text-foreground bg-tape-yellow/70 px-1 -rotate-1 inline-block">
          오늘의 지정복
        </span>
      </p>
      <div className="relative bg-accent border-2 border-foreground rounded-md shadow-sticker p-6 mb-6 overflow-visible">
        {/* 장식 이모지 — 지정복 타입에 맞게 */}
        <span className="absolute -top-3 -right-2 text-2xl rotate-[-8deg]" aria-hidden="true">
          {meta?.topEmoji || '👕'}
        </span>
        <span className="absolute -bottom-3 -left-2 text-2xl" aria-hidden="true">
          {meta?.bottomEmoji || '👖'}
        </span>
        <p className="font-display font-bold text-[19px] leading-snug text-center text-on-accent">
          {loading
            ? '오늘의 지정복을 확인하고 있어요...'
            : outfitType
              ? `오늘은 ${today.label} — ${outfitType} 입는 날이에요`
              : `오늘(${today.label})은 아직 지정된 옷차림이 없어요`}
        </p>
        {errorMsg && <p className="text-[12px] text-center text-on-accent/80 mt-2">{errorMsg}</p>}

        {/* 상의/하의 이모지 원형 아이콘 (체육복/반팔 등에 딱 맞춤) */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-full bg-surface-muted ring-4 ring-surface shadow-soft flex items-center justify-center">
            <span className="text-3xl" aria-hidden="true">{meta?.topEmoji || '👕'}</span>
          </div>
          <div className="w-16 h-16 rounded-full bg-surface-muted ring-4 ring-surface shadow-soft flex items-center justify-center">
            <span className="text-3xl" aria-hidden="true">{meta?.bottomEmoji || '👖'}</span>
          </div>
        </div>
      </div>

      {/* 추천 옷차림 */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="font-display font-bold text-[17px] text-secondary relative inline-block">
            추천 옷차림
            <svg className="absolute left-0 -bottom-1 w-full h-2 pointer-events-none" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2,6 C20,2 35,9 50,5 C65,1 80,8 98,4" fill="none" stroke="#0055FF" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </p>
          {wardrobe.length > 0 && (
            <span className="text-[11px] text-primary font-display font-bold flex items-center gap-1">
              <i className="ph-fill ph-check-circle"></i> 내 옷장 연동됨
            </span>
          )}
        </div>

        <div className="relative pt-6 pb-2">
          <span className="absolute top-2 left-4 text-xl rotate-[-8deg]" aria-hidden="true">✨</span>
          <span className="absolute bottom-0 right-8 text-lg rotate-[10deg]" aria-hidden="true">
            {meta?.topEmoji || '👕'}
          </span>

          {outfitType ? (
            <>
              <div className="flex items-start justify-center gap-4 flex-wrap pt-4 pb-2">
                {outfitItems.map((item) => (
                  <OutfitCard key={item.label} {...item} />
                ))}
              </div>
              <p className="font-display font-bold text-[17px] mb-1 text-center mt-4">
                {childName}, 오늘은 이렇게 입어요!
              </p>
              <p className="text-[15px] text-foreground-muted leading-[22px] text-center px-2">
                {recommendation ? recommendation.note : `오늘은 ${outfitType} 입는 날이에요.`}
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
