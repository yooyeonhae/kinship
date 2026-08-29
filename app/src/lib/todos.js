// 할일의 "오늘" 기준과 아이의 별.
//
// migration_18 이전에는 todos에 날짜가 없어서, 아이 화면이 "오늘 할일"이라 부르면서
// 실제로는 그 아이의 할일 전부를 보여줬다. 어제 안 한 일이 오늘 그대로 남아 별 막대가
// 끝없이 길어졌고, "오늘 다 했다"가 성립하지 않았다.

import { toDateInputValue } from './schedules'

export const DAILY_SELF_LIMIT = 10

export function todayValue(date = new Date()) {
  return toDateInputValue(date)
}

export function tomorrowValue(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return toDateInputValue(d)
}

// 목록에 붙는 짧은 날짜표. 어제·오늘·내일은 숫자보다 말이 빠르게 읽힌다.
export function dueLabel(value, today = todayValue()) {
  if (!value) return ''
  if (value === today) return '오늘'
  if (value === tomorrowValue()) return '내일'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (value === toDateInputValue(yesterday)) return '어제'
  const [, m, d] = value.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function isOverdue(todo, today = todayValue()) {
  return !todo.is_done && todo.due_date < today
}

// 세 묶음으로 나눈다.
//  - given   : 부모가 준 오늘 할일
//  - mission : 아이가 스스로 정한 것. **날짜가 지났어도 아직 안 했으면 여기 남는다** —
//              내가 정한 미션은 며칠 전 것이어도 '내 미션'이지 '밀린 숙제'가 아니다.
//              이 규칙 덕분에 서버·화면의 '오늘'이 한 칸 어긋나도(시간대 문제,
//              migration_20 참고) 미션이 지난 일 칸으로 떨어지지 않는다.
//  - overdue : 부모가 준 것 중 날짜가 지났는데 아직 안 한 것
export function splitByDay(todos, today = todayValue()) {
  const list = todos || []
  return {
    given: list.filter((t) => !t.self_made && t.due_date === today),
    mission: list.filter((t) => t.self_made && (t.due_date === today || !t.is_done)),
    today: list.filter((t) => t.due_date === today),
    overdue: list.filter((t) => !t.self_made && isOverdue(t, today)),
  }
}

// 별은 **부모가 승인한 할일만** 센다. 아이가 체크만 하면 "승인 기다리는 중"이고,
// 부모가 도장을 찍은 순간 합계에 들어간다.
//
// 왜 승인을 게이트로 두나: 체크는 아이가 혼자 누르는 것이라 실제로 했는지는 아이만
// 안다. 별이 보상으로 바뀌는 값이라면 그 사실을 확인하는 사람이 있어야 하고, 그
// 확인이 곧 "봤다"는 신호가 되어 아이에게 전해진다.
//
// 예전에 있던 '도장 = 별 2배'는 없앴다. 승인이 게이트가 되면 미승인이 0이라
// 배수의 기준이 사라져서, 2배라는 말이 아무것도 뜻하지 않게 된다.
export function starsOf(todo, requireApproval = true) {
  if (!todo.is_done) return 0
  return requireApproval ? (todo.approved_by ? 1 : 0) : 1
}

// 아이가 모은 별과, 승인을 기다리는 개수.
// 적립식으로 쌓지 않는 이유는 가족 포인트와 같다 — 체크를 켰다 껐다 하는 것만으로
// 늘어나면 안 된다. 상태에서 세면 체크를 풀 때 별도 함께 돌아간다.
export async function loadStars(supabase, memberId, requireApproval = true) {
  const { data, error } = await supabase
    .from('todos')
    .select('approved_by')
    .eq('assignee_member_id', memberId)
    .eq('is_done', true)
  if (error) return { error }
  const rows = data || []
  const approved = rows.filter((r) => r.approved_by).length
  // 승인을 요구하지 않는 가족은 끝낸 것이 곧 별이다. 기다리는 것도 없다.
  if (!requireApproval) return { data: rows.length, pending: 0 }
  return { data: approved, pending: rows.length - approved }
}

export async function approveTodo(supabase, todoId) {
  const { data, error } = await supabase.rpc('approve_todo', { p_todo_id: todoId })
  if (error) return { error }
  return data?.ok ? { data: data.todo } : { reason: data?.error || 'unknown' }
}

// 연속 달성. "그날 마감인 할일이 있었고 전부 끝낸 날"이 하루로 센다.
//
// 규칙 두 개가 중요하다.
//  - 할일이 하나도 없던 날은 **건너뛴다**(끊지도, 세지도 않는다). 부모가 아무것도
//    안 준 날에 아이가 연속을 잃으면 아이 잘못이 아닌 일로 벌을 주는 셈이다.
//  - 오늘이 아직 안 끝났으면 **끊지 않는다**. 하루가 끝나기 전에 "연속 끊김"을
//    보여주면 지금 하려던 아이의 의욕을 꺾는다. 오늘을 다 했으면 그때 +1.
const STREAK_LOOKBACK = 60

export function computeStreak(rows, today = todayValue()) {
  const byDay = new Map()
  for (const r of rows || []) {
    if (!r.due_date) continue
    const day = byDay.get(r.due_date) || { total: 0, done: 0 }
    day.total += 1
    if (r.is_done) day.done += 1
    byDay.set(r.due_date, day)
  }

  let streak = 0
  const cursor = new Date(`${today}T00:00:00`)
  for (let i = 0; i < STREAK_LOOKBACK; i++) {
    const key = toDateInputValue(cursor)
    const day = byDay.get(key)
    cursor.setDate(cursor.getDate() - 1)
    if (!day || day.total === 0) continue
    if (day.done === day.total) {
      streak += 1
      continue
    }
    if (key === today) continue
    break
  }
  return streak
}

// 스트릭 계산에 필요한 만큼만 읽는다(날짜와 완료 여부).
export async function loadStreakRows(supabase, memberId) {
  const from = new Date()
  from.setDate(from.getDate() - STREAK_LOOKBACK)
  const { data, error } = await supabase
    .from('todos')
    .select('due_date, is_done')
    .eq('assignee_member_id', memberId)
    .gte('due_date', toDateInputValue(from))
  if (error) return { error }
  return { data: data || [] }
}

// 아이가 스스로 넣는 할일. 담당자·마감일·self_made를 서버가 정한다(add_my_todo).
export async function addMyTodo(supabase, title) {
  const { data, error } = await supabase.rpc('add_my_todo', { p_title: title })
  if (error) return { error }
  return data?.ok ? { data: data.todo } : { reason: data?.error || 'unknown' }
}

export async function deleteMyTodo(supabase, todoId) {
  const { data, error } = await supabase.rpc('delete_my_todo', { p_todo_id: todoId })
  if (error) return { error }
  return data?.ok ? { data: true } : { reason: data?.error || 'unknown' }
}

export function addTodoMessage(reason, limit = DAILY_SELF_LIMIT) {
  if (reason === 'daily_limit') return `하루에 ${limit}개까지 넣을 수 있어요.`
  if (reason === 'duplicate') return '오늘 이미 넣은 할일이에요.'
  if (reason === 'too_long') return '조금만 더 짧게 적어주세요.'
  if (reason === 'empty_title') return '할일을 적어주세요.'
  if (reason === 'identity_required') return '누구인지 알 수 없어요. 처음 화면에서 다시 들어와 주세요.'
  return '넣지 못했어요. migration_18을 실행했는지 확인해주세요.'
}

// 아이가 타이핑 없이 고르는 칩. 부모의 quick_tasks처럼 DB에 두지 않은 이유는
// 이건 가족마다 다른 값이 아니라 "아이가 자주 하는 일"의 기본 보기이고,
// 아이는 직접 적을 수도 있기 때문이다. 원하는 게 없으면 적으면 된다.
export const CHILD_QUICK_TASKS = [
  { label: '양치하기', icon: 'ph-tooth' },
  { label: '숙제하기', icon: 'ph-pencil' },
  { label: '책 읽기', icon: 'ph-book-open' },
  { label: '방 정리', icon: 'ph-broom' },
  { label: '물 마시기', icon: 'ph-drop' },
  { label: '준비물 챙기기', icon: 'ph-backpack' },
]
