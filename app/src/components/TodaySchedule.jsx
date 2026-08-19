import { useCallback, useEffect, useRef, useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import { alarmAt, alarmLabel, byTime, formatTime, isToday, showAlarm } from '../lib/schedules'

// 아이 화면에 오늘 일정을 보여주고, 알림 시각이 되면 알린다.
//
// 알림은 **앱이 열려 있는 동안에만** 울린다. 앱을 닫아둔 채 울리는 진짜 푸시는
// 서비스 워커와 푸시 서버가 있어야 하고, 그건 이 프로젝트의 기술 선택(정적 SPA)
// 밖이다. 그래서 화면에도 그 조건을 적어둔다 — 울릴 거라고 믿고 앱을 닫으면
// 아무 일도 일어나지 않기 때문이다.
function TodaySchedule({ memberId, memberName }) {
  const { supabase, familyId } = useFamily()
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const timersRef = useRef([])

  const load = useCallback(async () => {
    if (!familyId || !memberId) return
    const { data, error } = await supabase.from('schedules').select('*').eq('member_id', memberId)
    if (error) {
      // 마이그레이션 전이면 이 섹션만 조용히 숨긴다 — 아이 화면에 관리자용 안내를 띄울 이유가 없다
      setLoaded(true)
      return
    }
    setItems((data || []).filter((s) => isToday(s)).sort(byTime))
    setLoaded(true)
  }, [supabase, familyId, memberId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    // 화면을 다시 그릴 때마다 예약이 쌓이면 같은 알림이 여러 번 뜬다
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    for (const schedule of items) {
      const at = alarmAt(schedule)
      if (!at) continue
      const delay = at.getTime() - Date.now()
      // setTimeout은 약 24.8일이 넘으면 즉시 실행된다. 오늘 일정이라 넘을 일은 없지만,
      // 시계를 되돌리는 등으로 음수가 들어오면 즉시 울리므로 막는다.
      if (delay <= 0) continue
      timersRef.current.push(setTimeout(() => showAlarm(schedule, memberName), delay))
    }

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [items, memberName])

  if (!loaded || items.length === 0) return null

  return (
    <section className="bg-surface border-2 border-foreground rounded-md shadow-sticker px-4 py-4 mb-5">
      <p className="font-display font-bold text-[15px] flex items-center gap-2 mb-3">
        <i className="ph-duotone ph-calendar-dots text-xl text-primary"></i>오늘 일정
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((s) => (
          <li key={s.schedule_id} className="flex items-center gap-3">
            <span className="font-display font-bold text-[14px] text-primary shrink-0 w-[68px]">
              {formatTime(s.start_time)}
            </span>
            <span className="min-w-0">
              <span className="font-display font-bold text-[15px]">{s.title}</span>
              {s.alarm_minutes !== null && (
                <span className="block text-[12px] text-foreground-muted">{alarmLabel(s.alarm_minutes)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {items.some((s) => s.alarm_minutes !== null) && (
        <p className="text-[12px] text-foreground-muted mt-3 pt-2 border-t border-dashed border-border leading-[18px]">
          알림은 이 앱을 켜둔 동안에만 울려요.
        </p>
      )}
    </section>
  )
}

export default TodaySchedule
