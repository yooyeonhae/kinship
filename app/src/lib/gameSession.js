// 원격 대전 세션. 판(state)은 jsonb 한 칸에 통째로 오간다 — 규칙은 화면이 갖고 있고
// DB는 "지금 판이 이렇다"만 나른다(migration_16 주석 참고).

export const GAME_EVENT = 'game'

// 만든 지 오래된 방은 목록에서 치운다. 아무도 안 들어온 방이 계속 쌓이면
// 어느 게 지금 하려는 판인지 알 수 없어진다.
const STALE_MINUTES = 120

export async function loadSessions(supabase) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) return { error }
  const cutoff = Date.now() - STALE_MINUTES * 60 * 1000
  return { data: (data || []).filter((s) => Date.parse(s.updated_at) >= cutoff) }
}

export async function createSession(supabase, { familyId, gameKey, memberId, state }) {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      family_id: familyId,
      game_key: gameKey,
      p1_member_id: memberId,
      state,
      turn: 'p1',
    })
    .select()
    .single()
  return { data, error }
}

export async function joinSession(supabase, session, memberId) {
  // 이미 누가 들어와 있으면 덮어쓰지 않는다. 세 번째 사람이 눌러도 판이 바뀌면 안 된다.
  const { data, error } = await supabase
    .from('game_sessions')
    .update({ p2_member_id: memberId, updated_at: new Date().toISOString() })
    .eq('session_id', session.session_id)
    .is('p2_member_id', null)
    .select()
    .maybeSingle()
  return { data, error }
}

export async function pushState(supabase, sessionId, { state, turn, winner }) {
  const { data, error } = await supabase
    .from('game_sessions')
    .update({ state, turn, winner: winner || null, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .select()
    .single()
  return { data, error }
}

export async function fetchSession(supabase, sessionId) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  return { data, error }
}

export async function leaveSession(supabase, sessionId) {
  await supabase.from('game_sessions').delete().eq('session_id', sessionId)
}

// 내가 이 판에서 p1인지 p2인지. 어느 쪽도 아니면 구경만 한다.
export function roleOf(session, memberId) {
  if (!session) return null
  if (session.p1_member_id === memberId) return 'p1'
  if (session.p2_member_id === memberId) return 'p2'
  return null
}

export function isMyTurn(session, memberId) {
  const role = roleOf(session, memberId)
  return Boolean(role) && !session.winner && session.turn === role && session.p2_member_id
}
