// 요일별 스케줄의 날짜 계산과 알림.
//
// 알림의 한계를 먼저 적어둔다: 이 앱은 정적 SPA라 백그라운드에서 도는 서버도
// 서비스 워커도 없다. 따라서 **앱이 열려 있는 동안에만** 알림을 띄울 수 있다.
// 앱을 닫아둔 채로 울리는 진짜 푸시 알림은 서비스 워커 + 푸시 서버(VAPID)가 있어야
// 하고, 그건 "정적 SPA + 프록시 몇 개"라는 이 프로젝트의 기술 선택을 벗어난다.

// schema.sql의 day_of_week CHECK와 같은 값. 인덱스는 Date#getDay()에 맞춘다.
export const DAY_KEYS = ['일', '월', '화', '수', '목', '금', '토']
// 화면 표시 순서는 월~일
export const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

export function todayKey(date = new Date()) {
  return DAY_KEYS[date.getDay()]
}

export function toDateInputValue(date = new Date()) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${date.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`
}

// "09:30:00" / "09:30" 어느 쪽으로 와도 화면에는 "오전 9:30"으로 보여준다.
export function formatTime(value) {
  if (!value) return ''
  const [h, m] = value.split(':')
  const hour = Number(h)
  const period = hour < 12 ? '오전' : '오후'
  const h12 = hour % 12 || 12
  return `${period} ${h12}:${m}`
}

export function isToday(schedule, date = new Date()) {
  if (schedule.repeat_type === 'weekly') return schedule.day_of_week === todayKey(date)
  return schedule.schedule_date === toDateInputValue(date)
}

// 정렬 기준은 시간. 같은 시간이면 제목으로 흔들리지 않게 고정한다.
export function byTime(a, b) {
  return a.start_time.localeCompare(b.start_time) || a.title.localeCompare(b.title)
}

// 오늘 이 일정이 울려야 할 시각. 이미 지났으면 null.
export function alarmAt(schedule, now = new Date()) {
  if (schedule.alarm_minutes === null || schedule.alarm_minutes === undefined) return null
  if (!isToday(schedule, now)) return null
  const [h, m] = schedule.start_time.split(':').map(Number)
  const at = new Date(now)
  at.setHours(h, m, 0, 0)
  at.setMinutes(at.getMinutes() - schedule.alarm_minutes)
  return at.getTime() <= now.getTime() ? null : at
}

export function alarmLabel(minutes) {
  if (minutes === null || minutes === undefined) return '알림 없음'
  if (minutes === 0) return '시작할 때 알림'
  if (minutes % 60 === 0) return `${minutes / 60}시간 전 알림`
  return `${minutes}분 전 알림`
}

export async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function showAlarm(schedule, memberName) {
  const body = `${formatTime(schedule.start_time)} · ${memberName}`
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(schedule.title, { body, tag: schedule.schedule_id })
    return true
  }
  return false
}
