// 가족이 직접 정하는 값들 (migration_21).
//
// 행이 없는 가족은 기본값으로 본다 — 설정을 한 번도 안 건드린 가족도 그대로 돌아가야 하고,
// 나중에 기본값을 바꾸면 그 가족들에게 자동으로 적용된다.

export const SETTINGS_EVENT = 'kinship:settings'

export const DEFAULT_SETTINGS = {
  todo_point: 10,
  mission_daily_limit: 10,
  mission_weekend_limit: 15,
  require_approval: true,
  todo_keep_days: 30,
  chat_keep_days: 7,
  overdue_days: 7,
  default_region: '서울',
}

// 토·일이면 주말 상한을 쓴다. 서버(add_my_todo)도 같은 기준으로 판정하므로,
// 화면에 적히는 숫자와 실제로 막히는 숫자가 어긋나지 않는다.
export function isWeekend(date = new Date()) {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function missionLimitOf(settings, date = new Date()) {
  return isWeekend(date) ? settings.mission_weekend_limit : settings.mission_daily_limit
}

// 설정 화면에서 쓰는 정의. 값의 범위와 설명을 한곳에 둬서, 화면과 CHECK 제약이
// 어긋나지 않게 한다(어긋나면 저장 버튼을 눌러야만 알 수 있다).
export const SETTING_FIELDS = [
  {
    key: 'todo_point',
    kind: 'number',
    label: '할일 1개 완료 = 가족 포인트',
    help: '0으로 두면 할일은 포인트를 주지 않고 게임 점수만 쌓여요.',
    min: 0,
    max: 100,
    unit: 'p',
  },
  {
    key: 'mission_daily_limit',
    kind: 'number',
    label: '아이가 하루에 정할 수 있는 미션',
    help: '아이가 스스로 넣는 “나의 미션”의 하루 상한이에요.',
    min: 1,
    max: 30,
    unit: '개',
  },
  {
    key: 'mission_weekend_limit',
    kind: 'number',
    label: '주말에 정할 수 있는 미션',
    help: '토·일에는 이 개수까지 넣을 수 있어요. 학교에 안 가는 날은 스스로 할 일이 더 많으니까요.',
    min: 1,
    max: 30,
    unit: '개',
  },
  {
    key: 'overdue_days',
    kind: 'number',
    label: '지난 일을 며칠까지 보여줄까',
    help: '아이 화면 아래 “며칠 전 못 한 일”에 얼마나 거슬러 올라가 보여줄지예요.',
    min: 1,
    max: 30,
    unit: '일',
  },
  {
    key: 'default_region',
    kind: 'region',
    label: '우리 동네 (시·도)',
    help: '날씨와 주말 나들이가 이 지역을 기준으로 나와요.',
  },
  {
    key: 'require_approval',
    kind: 'toggle',
    label: '별은 부모가 확인한 뒤에',
    help: '끄면 아이가 체크하는 순간 별이 돼요. 켜두면 부모가 도장을 찍어야 합산돼요.',
  },
  {
    key: 'todo_keep_days',
    kind: 'number',
    label: '밀린 할일 자동 정리',
    help: '마감일이 이만큼 지났는데 아직 안 한 할일을 지워요. 0이면 정리하지 않아요. 완료한 할일은 지우지 않아요.',
    min: 0,
    max: 365,
    unit: '일 뒤',
  },
  {
    key: 'chat_keep_days',
    kind: 'number',
    label: '가족톡 보관 기간',
    help: '이 기간이 지난 대화는 자동으로 사라져요.',
    min: 1,
    max: 90,
    unit: '일',
  },
]

export async function loadSettings(supabase) {
  const { data, error } = await supabase.from('family_settings').select('*').maybeSingle()
  // 표가 아직 없거나(마이그레이션 전) 행이 없으면 기본값으로 돌아간다 — 설정 하나 때문에
  // 앱 전체가 멈추면 안 된다.
  if (error) return { data: DEFAULT_SETTINGS, missing: true }
  return { data: { ...DEFAULT_SETTINGS, ...(data || {}) } }
}

export async function saveSettings(supabase, familyId, values) {
  const payload = { family_id: familyId, updated_at: new Date().toISOString() }
  for (const f of SETTING_FIELDS) payload[f.key] = values[f.key]
  const { error } = await supabase.from('family_settings').upsert(payload, { onConflict: 'family_id' })
  if (error) return { error }
  // 포인트 배점이나 승인 규칙이 바뀌면 다른 화면의 숫자도 달라진다.
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))
  return { ok: true }
}

// 가족 이름은 families 표에 있어서 설정값과 저장 경로가 다르다.
export async function saveFamilyName(supabase, familyId, name) {
  const value = name.trim()
  if (!value) return { reason: 'empty' }
  if (value.length > 20) return { reason: 'too_long' }
  const { error } = await supabase.from('families').update({ name: value }).eq('family_id', familyId)
  if (error) {
    // migration_10의 unique 인덱스에 걸린 경우 — 대소문자·공백만 다른 이름도 같은 이름으로 본다
    if (error.code === '23505') return { reason: 'name_taken' }
    if (error.code === '42501') return { reason: 'parent_only' }
    return { error }
  }
  return { ok: true }
}

export function familyNameMessage(reason) {
  if (reason === 'empty') return '가족 이름을 적어주세요.'
  if (reason === 'too_long') return '가족 이름은 20자까지예요.'
  if (reason === 'name_taken') return '이미 같은 이름의 가족이 있어요.'
  if (reason === 'parent_only') return '가족 이름은 부모만 바꿀 수 있어요. migration_22를 실행했는지도 확인해주세요.'
  return '이름을 바꾸지 못했어요.'
}

export function settingsErrorMessage(error) {
  if (error?.code === '42501') return '설정은 부모만 바꿀 수 있어요.'
  if (/does not exist|schema cache/i.test(`${error?.message || ''}`)) {
    return '설정을 쓰려면 migration_21_family_settings.sql을 실행해주세요.'
  }
  if (error?.code === '23514') return '넣을 수 있는 범위를 벗어났어요.'
  return '설정을 저장하지 못했어요.'
}

// 밀린 할일 정리. 앱을 열 때 한 번만 부른다 — 화면을 옮길 때마다 지우기를 보내면
// 하는 일 없는 요청이 계속 나간다.
let purgedThisSession = false

export async function purgeOldTodosOnce(supabase) {
  if (purgedThisSession) return
  purgedThisSession = true
  const { data, error } = await supabase.rpc('purge_old_todos')
  if (error) return
  if (data > 0) window.dispatchEvent(new CustomEvent('kinship:change'))
}
