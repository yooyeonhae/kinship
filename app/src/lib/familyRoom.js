// 아지트의 Realtime 계층.
//
// 왜 postgres_changes가 아니라 Broadcast인가 — 이 앱의 신원은 PostgREST 요청 헤더
// (x-family-id)에만 실린다. postgres_changes는 웹소켓 연결의 JWT로 RLS를 평가하므로
// 그 헤더가 없고, current_family_id()가 null이 되어 어떤 행도 전달되지 않는다.
// 그래서 "테이블에 INSERT는 PostgREST로, 알림은 Broadcast로"를 조합한다.
// PRD 3.8이 지정한 Broadcast/Presence와도 일치한다.
//
// 채널 이름에 family_id가 들어가므로 family_id를 아는 사람은 채널에 들어올 수 있다.
// 이 앱 전체가 그 전제 위에 있다(CLAUDE.md "남는 한계" 참고) — 채팅만의 문제가 아니다.

export const CHAT_EVENT = 'chat'
export const POINTS_EVENT = 'points'

export function familyChannelName(familyId) {
  return `family-room:${familyId}`
}

// 승리 10p, 무승부 5p. migration_05의 CHECK와 반드시 같아야 한다 —
// 다른 값을 보내면 INSERT가 제약에 걸려 통째로 실패한다.
export function pointsFor(isDraw) {
  return isDraw ? 5 : 10
}

// 끝낸 할일 하나당 주는 점수.
export const TODO_POINT = 10

// 할일 점수는 별도 표에 쌓지 않고 "지금 완료 상태인 할일 수"에서 매번 계산한다.
// 완료 이벤트를 적립식으로 쌓으면 체크를 켰다 껐다 반복하는 것만으로 점수가 무한히
// 늘어난다. 상태에서 계산하면 체크를 풀 때 점수도 함께 돌아가므로 그럴 여지가 없다.
export async function loadTodoPoints(supabase) {
  const { count, error } = await supabase
    .from('todos')
    .select('todo_id', { count: 'exact', head: true })
    .eq('is_done', true)
  if (error) return { error }
  return { data: (count || 0) * TODO_POINT }
}

export async function loadChat(supabase, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return { error }
  // 최신 N개를 받아 다시 오름차순으로 뒤집는다. 오름차순 + limit이면 오래된 것만 남는다.
  return { data: (data || []).reverse() }
}

export async function sendChat(supabase, { familyId, memberId, senderName, content }) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ family_id: familyId, member_id: memberId || null, sender_name: senderName, content })
    .select()
    .single()
  return { data, error }
}

export async function loadGamePoints(supabase) {
  const { data, error } = await supabase.from('game_results').select('points')
  if (error) return { error }
  return { data: (data || []).reduce((sum, r) => sum + (r.points || 0), 0) }
}

// 가족 포인트 = 게임에서 얻은 점수 + 끝낸 할일 점수
export async function loadPoints(supabase) {
  const [game, todo] = await Promise.all([loadGamePoints(supabase), loadTodoPoints(supabase)])
  if (game.error) return { error: game.error }
  if (todo.error) return { error: todo.error }
  return { data: { total: game.data + todo.data, game: game.data, todo: todo.data } }
}

export async function recordGameResult(supabase, { familyId, gameKey, winnerId, opponentId, isDraw }) {
  const { data, error } = await supabase
    .from('game_results')
    .insert({
      family_id: familyId,
      game_key: gameKey,
      // 무승부에 승자를 실어 보내면 game_results_winner_check에 걸린다
      winner_member_id: isDraw ? null : winnerId || null,
      opponent_member_id: opponentId || null,
      is_draw: isDraw,
      points: pointsFor(isDraw),
    })
    .select()
    .single()
  return { data, error }
}

// 아직 마이그레이션을 실행하지 않았을 때 "왜 안 되는지"를 화면에서 구분할 수 있게 한다.
export function isMissingTable(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  return error?.code === '42P01' || /does not exist|schema cache/i.test(text)
}
