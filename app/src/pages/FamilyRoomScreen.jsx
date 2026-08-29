import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { MEMBER_BG_CLASS, colorTokenForMember } from '../lib/memberColors'
import FamilyRewards from '../components/FamilyRewards'
import { characterOf } from '../lib/avatars'
import { allowedHeads, checkWord, lastCharOf, randomSeedWord } from '../lib/wordChain'
import { DEFAULT_SETTINGS, SETTINGS_EVENT, loadSettings } from '../lib/settings'
import { notifyFamily } from '../lib/push'
import {
  GAME_EVENT,
  createSession,
  fetchSession,
  isMyTurn,
  joinSession,
  leaveSession,
  loadSessions,
  purgeStaleSessions,
  pushState,
  removeMyOpenSessions,
  roleOf,
} from '../lib/gameSession'
import {
  CHAT_EVENT,
  POINTS_EVENT,
  familyChannelName,
  isMissingTable,
  isUnknownGameKey,
  loadChat,
  loadPoints,
  TODO_POINT,
  pointsFor,
  recordGameResult,
  sendChat,
} from '../lib/familyRoom'

const GAME_TABS = [
  { key: 'wordchain', label: '끝말잇기', sub: '끝 글자로 이어 말하기', icon: 'ph-chats-circle', bgClass: 'bg-pastel-mint' },
  { key: 'bingo', label: '계산 빙고', sub: '암산으로 한 줄 빙고', icon: 'ph-grid-four', bgClass: 'bg-pastel-sky' },
  { key: 'stairs', label: '계단 오르기', sub: '주사위로 먼저 도착하기', icon: 'ph-flag-checkered', bgClass: 'bg-tape-pink/25' },
  { key: 'updown', label: '숫자 맞히기', sub: '내 숫자 먼저 맞히기', icon: 'ph-arrows-down-up', bgClass: 'bg-tape-yellow/25' },
]

const BINGO_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const STAIRS_TARGET = 30

// 한 판이 끝났을 때 결과를 정확히 한 번만 기록하기 위한 식별자.
// winner만 보고 기록하면 리렌더나 StrictMode의 이중 실행에서 같은 판이 두 번 들어간다.
let nextRoundId = 1

function formatChatTime(iso) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  const m = d.getMinutes()
  return `${period} ${h12}:${m < 10 ? '0' : ''}${m}`
}

// 끝말잇기. 첫 단어는 앱이 낸다(사람이 시작하면 "무슨 말부터?"에서 멈춘다).
// 규칙 판정은 lib/wordChain.js에 있고 사전 검사는 하지 않는다 — 그 경계는 화면에 적었다.
// 번갈아 하는 게임은 어느 쪽이든 선이 유리해서, 판마다 선을 바꾼다(진 사람이 다음 선).
function newWordChainState(firstTurn = 'p1') {
  return {
    roundId: nextRoundId++,
    // { who: 'p1' | 'p2' | 'seed', word }
    words: [{ who: 'seed', word: randomSeedWord() }],
    turn: firstTurn,
    feedback: null,
    endedBy: null,
    winner: null,
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeBingoBoard() {
  const pool = []
  for (let i = 2; i <= 20; i++) pool.push(i)
  shuffle(pool)
  return pool.slice(0, 9).map((v) => ({ value: v, marked: false }))
}

// 문제는 "지금 차례인 사람의 판에 아직 안 뚫린 칸"에서 거꾸로 만든다.
// 예전에는 2~9끼리 곱해서 문제를 냈는데 판에는 2~20만 있어서, 정답이 어느 판에도
// 없는 문제가 대부분이었다. 그러면 차례를 버리는 것 말고 할 수 있는 게 없다.
function problemForValue(answer) {
  // 곱셈으로 만들 수 있으면(2 이상 두 수의 곱) 곱셈을, 아니면 덧셈을 낸다
  const factors = []
  for (let a = 2; a * a <= answer; a++) {
    if (answer % a === 0 && answer / a >= 2) factors.push([a, answer / a])
  }
  if (factors.length && Math.random() < 0.5) {
    const [a, b] = factors[Math.floor(Math.random() * factors.length)]
    return { text: `${a} × ${b}`, answer }
  }
  const a = 1 + Math.floor(Math.random() * (answer - 1))
  return { text: `${a} + ${answer - a}`, answer }
}

// 한 차례에 문제를 두 개 낸다. 정답이 하나뿐이면 "그 칸을 누른다" 말고 할 게 없어서,
// 칸이 뚫리는 순서가 완전한 무작위 순열이 되고 승부가 전부 운이었다(시뮬레이션에서
// 선공 승률 65%). 두 문제 중 하나를 골라 풀게 하면, 내 줄에 필요한 칸을 스스로 고른다.
function bingoProblemsFor(board) {
  const open = board.filter((c) => !c.marked)
  const pool = (open.length ? open : board).map((c) => c.value)
  return shuffle(pool).slice(0, 2).map(problemForValue)
}

function checkBingoWin(board) {
  return BINGO_LINES.some((line) => line.every((i) => board[i].marked))
}

// 빙고도 선공이 유리하다(먼저 한 칸을 앞서간다). 판마다 선을 바꿔 상쇄한다.
function newBingoState(firstTurn = 'p1') {
  const boards = { p1: makeBingoBoard(), p2: makeBingoBoard() }
  return {
    roundId: nextRoundId++,
    boards,
    turn: firstTurn,
    winner: null,
    problems: bingoProblemsFor(boards[firstTurn]),
    feedback: null,
  }
}

const DICE_ICON = ['', 'ph-dice-one', 'ph-dice-two', 'ph-dice-three', 'ph-dice-four', 'ph-dice-five', 'ph-dice-six']

// 예전 계단 오르기는 "굴린다 → 그만큼 올라간다"가 전부여서 이길지 질지가 전부 운이었고,
// 플레이어가 할 결정이 하나도 없었다. 굴린 눈을 바로 올리지 않고 '모아둔 칸'에 쌓아,
// 한 번 더 굴릴지 여기서 멈출지 고르게 한다. 1이 나오면 모아둔 것을 전부 잃는다.
// 한 턴에 모을 수 있는 상한을 두면(예전에는 10칸) "1이 나오기 전까지는 굴리는 게 항상
// 이득"이라 상한에 닿을 때까지 굴리는 것 말고 할 게 없어진다 — 모아둔 칸이 매번 0 아니면
// 10으로만 끝나고 고를 것이 사라진다. 상한을 없애면 "지금 멈출까"가 진짜 판단이 된다.
// 선공이 첫 턴에 목표를 다 모으는 판이 걱정이지만, 그때도 chaseFor로 상대가 같은 조건의
// 마지막 한 턴을 받는다.

function newStairsState(firstTurn = 'p1') {
  return {
    roundId: nextRoundId++,
    p1: 0,
    p2: 0,
    pot: 0,
    lastRoll: null,
    bust: false,
    // 굴린 횟수. 주사위 애니메이션을 이 값으로 돌리면, 상대 기기에서 굴린 것도
    // 내 화면에서 똑같이 굴러간다 — 숫자만 바뀌면 상대가 굴렸는지 알아채기 어렵다.
    rolls: 0,
    // 마지막에 무슨 일이 있었는지(누가 / 굴렸나·잃었나·쌓았나 / 몇 칸).
    // 특히 1이 나와 차례가 넘어가는 순간은 두 기기 모두에서 분명히 보여야 한다.
    lastEvent: null,
    turn: firstTurn,
    // 먼저 목표에 닿아도 바로 끝내지 않는다. 상대에게 같은 횟수의 기회를 주지 않으면
    // 선공이 그대로 유리하다. 이 값이 채워지면 "그 사람의 마지막 한 턴"이다.
    chaseFor: null,
    winner: null,
  }
}

function stairsVerdict(p1, p2) {
  if (p1 === p2) return 'draw'
  return p1 > p2 ? 'p1' : 'p2'
}

const UPDOWN_MIN = 1
const UPDOWN_MAX = 100

function randomSecret() {
  return UPDOWN_MIN + Math.floor(Math.random() * (UPDOWN_MAX - UPDOWN_MIN + 1))
}

// 예전에는 두 사람이 '같은' 숫자 하나를 번갈아 맞혔다. 그러면 남은 범위의 가운데를
// 부르는 것 말고 할 게 없고, 범위가 몇 번째 차례에 1로 줄어드는지가 처음부터 정해져
// 있어서 승자도 사실상 정해진 게임이었다. 각자 자기 숫자를 맞히는 경주로 바꾸면,
// 같은 방식으로 좁혀도 어느 쪽 숫자가 먼저 걸리는지가 판마다 달라진다.
// 첫 차례가 유리하다(같은 방식으로 좁혀도 한 번 먼저 부른다). 판마다 선을 바꿔서
// 여러 판을 하면 그 이득이 상쇄되게 한다 — 진 사람이 다음 판의 선이다.
function newUpdownState(firstTurn = 'p1') {
  return {
    roundId: nextRoundId++,
    // 한 기기에서 번갈아 할 때는 정답을 상태에 두는 것 이상으로 숨길 방법이 없다.
    // 화면에 그리지 않는 선까지가 한계다.
    secrets: { p1: randomSecret(), p2: randomSecret() },
    ranges: { p1: { low: UPDOWN_MIN, high: UPDOWN_MAX }, p2: { low: UPDOWN_MIN, high: UPDOWN_MAX } },
    history: [],
    turn: firstTurn,
    winner: null,
  }
}

function FamilyRoomScreen() {
  const { supabase, familyId, members, currentMemberId } = useFamily()

  const [messages, setMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(true)
  const [chatSenderId, setChatSenderId] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [onlineIds, setOnlineIds] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const chatLogRef = useRef(null)
  const channelRef = useRef(null)

  const [points, setPoints] = useState(null)
  // 할일 1개가 몇 점인지는 가족이 정한다(migration_21). 기본은 10p.
  const [todoPoint, setTodoPoint] = useState(DEFAULT_SETTINGS.todo_point)

  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [activeGame, setActiveGame] = useState('wordchain')

  const [chain, setChain] = useState(newWordChainState)
  const [wordInput, setWordInput] = useState('')
  const [bingo, setBingo] = useState(newBingoState)
  const [stairs, setStairs] = useState(newStairsState)
  const [updown, setUpdown] = useState(newUpdownState)
  const [updownGuess, setUpdownGuess] = useState('')
  const [rolling, setRolling] = useState(false)

  // 원격 대전. null이면 예전처럼 한 기기에서 번갈아 한다.
  const [session, setSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [remoteMsg, setRemoteMsg] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  // 서버와 마지막으로 맞춘 판의 서명. 없으면 두 기기가 서로 밀어내며 무한히 돈다.
  // 플래그(불리언) 하나로는 부족했다 — 올린 뒤 돌아온 행의 state는 내용이 같아도
  // 새 객체라, 참조 비교로는 "안 바뀌었다"를 알 수 없어 올리기가 끝없이 되풀이됐다.
  // 그게 원격 대전이 느리고 자주 실패했던 이유다.
  const lastSyncedRef = useRef(null)
  // 채널 구독은 한 번만 만들어지므로, 콜백이 최신 값을 보게 ref로 들고 있는다.
  const sessionRef = useRef(null)
  const applySessionRef = useRef(null)
  const refreshSessionsRef = useRef(null)

  const recordedRounds = useRef(new Set())

  const memberName = useCallback(
    (id) => members.find((m) => m.member_id === id)?.name || '가족',
    [members]
  )

  // 선수/발신자 기본값은 실제 구성원에서 고른다. 예전에는 하준·서아·서연·민준이
  // 화면에 박혀 있어서, 누가 이겨도 저장할 member_id가 없었다.
  useEffect(() => {
    if (!members.length) return
    // 발신자는 고르는 값이 아니라 지금 앱을 쓰는 사람이다
    setChatSenderId(currentMemberId || members[0].member_id)
    setPlayer1Id((prev) => (members.some((m) => m.member_id === prev) ? prev : members[0].member_id))
    setPlayer2Id((prev) =>
      members.some((m) => m.member_id === prev) ? prev : (members[1] || members[0]).member_id
    )
  }, [members, currentMemberId])

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!rolling) return
    const t = setTimeout(() => setRolling(false), 400)
    return () => clearTimeout(t)
  }, [rolling])

  // 굴린 횟수가 늘면 주사위를 굴린다. 내가 굴렸을 때든 상대가 굴렸을 때든 같다.
  useEffect(() => {
    if (!stairs.rolls) return
    setRolling(true)
  }, [stairs.rolls, stairs.roundId])

  // 초기 로드 — 대화 기록과 지금까지 쌓인 포인트
  useEffect(() => {
    if (!familyId) return
    let alive = true
    ;(async () => {
      // 설정이 아직 안 왔으면 기본 배점으로 먼저 그린다. 값이 도착하면 위의
      // pointsPrimed 효과가 다시 계산한다.
      const [chat, pts] = await Promise.all([loadChat(supabase), loadPoints(supabase, todoPoint)])
      if (!alive) return
      if (chat.error || pts.error) {
        if (isMissingTable(chat.error || pts.error)) setNeedsMigration(true)
        else setErrorMsg('아지트를 불러오지 못했어요.')
        setChatLoading(false)
        return
      }
      setMessages(chat.data)
      setPoints(pts.data)
      setChatLoading(false)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, familyId])

  // 할일 점수는 완료 상태에서 계산하므로, 할일이 바뀌면 여기서도 다시 읽어야 한다.
  const refreshPoints = useCallback(async () => {
    const pts = await loadPoints(supabase, todoPoint)
    if (!pts.error) setPoints(pts.data)
  }, [supabase, todoPoint])

  // 배점이 바뀌면 지금 보이는 총점도 함께 바뀌어야 한다.
  useEffect(() => {
    if (!familyId) return
    let alive = true
    const read = async () => {
      const res = await loadSettings(supabase)
      if (alive) setTodoPoint(res.data.todo_point)
    }
    read()
    window.addEventListener(SETTINGS_EVENT, read)
    return () => {
      alive = false
      window.removeEventListener(SETTINGS_EVENT, read)
    }
  }, [supabase, familyId])

  // 배점이 바뀌면 총점을 다시 센다. 첫 실행은 위의 초기 로드가 이미 했으므로 건너뛴다 —
  // 안 건너뛰면 화면을 열 때마다 같은 계산이 두 번 나간다.
  const pointsPrimed = useRef(false)
  useEffect(() => {
    if (!pointsPrimed.current) {
      pointsPrimed.current = true
      return
    }
    refreshPoints()
  }, [refreshPoints])

  useEffect(() => {
    window.addEventListener('kinship:change', refreshPoints)
    window.addEventListener('kinship:points', refreshPoints)
    // 다른 화면에서 할일을 체크하고 이 탭으로 돌아왔을 때도 맞아야 한다
    document.addEventListener('visibilitychange', refreshPoints)
    return () => {
      window.removeEventListener('kinship:change', refreshPoints)
      window.removeEventListener('kinship:points', refreshPoints)
      document.removeEventListener('visibilitychange', refreshPoints)
    }
  }, [refreshPoints])


  // Realtime — 같은 가족 채널에 붙어 메시지·포인트를 주고받고, 누가 접속해 있는지 본다
  useEffect(() => {
    if (!familyId || !currentMemberId) return

    const channel = supabase.channel(familyChannelName(familyId), {
      config: { presence: { key: currentMemberId } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: CHAT_EVENT }, ({ payload }) => {
        // 보낸 쪽은 INSERT 응답으로 이미 넣었으므로 중복을 막는다
        setMessages((prev) =>
          prev.some((m) => m.message_id === payload.message_id) ? prev : [...prev, payload]
        )
      })
      .on('broadcast', { event: POINTS_EVENT }, ({ payload }) => {
        const gained = payload.points || 0
        setPoints((prev) => (prev === null ? prev : { ...prev, total: prev.total + gained, game: prev.game + gained }))
      })
      .on('broadcast', { event: GAME_EVENT }, async ({ payload }) => {
        // 판이 바뀌었다는 신호만 오고 내용은 DB에서 읽는다. 브로드캐스트는 순서를
        // 보장하지 않아서, 판 자체를 실어 보내면 오래된 판이 새 판을 덮을 수 있다.
        refreshSessionsRef.current?.()
        const active = sessionRef.current
        if (!active || active.session_id !== payload.sessionId) return
        const { data } = await fetchSession(supabase, payload.sessionId)
        if (data) applySessionRef.current?.(data)
        else setSession(null)
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineIds(Object.keys(channel.presenceState()))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ member_id: currentMemberId })
      })

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [supabase, familyId, currentMemberId])

  async function handleChatSubmit(e) {
    e.preventDefault()
    const content = chatInput.trim()
    if (!content || sending || !chatSenderId) return
    setSending(true)
    const { data, error } = await sendChat(supabase, {
      familyId,
      memberId: chatSenderId,
      senderName: memberName(chatSenderId),
      content,
    })
    setSending(false)
    if (error) {
      if (isMissingTable(error)) setNeedsMigration(true)
      else setErrorMsg('메시지를 보내지 못했어요.')
      return
    }
    setErrorMsg('')
    setChatInput('')
    setMessages((prev) => [...prev, data])
    channelRef.current?.send({ type: 'broadcast', event: CHAT_EVENT, payload: data })
    // 앱을 닫아둔 가족은 Broadcast로는 알 수 없다. 휴대폰 알림창은 푸시로만 뜬다.
    notifyFamily({ familyId, senderName: memberName(chatSenderId), excludeMemberId: chatSenderId })
  }

  // 한 판이 끝나면 결과를 남긴다. 이게 "가족 포인트"의 유일한 근거다.
  const finishRound = useCallback(
    async (gameKey, roundId, winnerKey) => {
      if (!familyId || recordedRounds.current.has(roundId)) return
      // 원격 대전은 두 기기가 같은 판을 보고 있어서, 둘 다 기록하면 포인트가 두 번 쌓인다.
      // 방을 만든 쪽에서만 남긴다.
      if (session && roleOf(session, currentMemberId) !== 'p1') return
      recordedRounds.current.add(roundId)

      const isDraw = winnerKey === 'draw'
      const oneId = session ? session.p1_member_id : player1Id
      const twoId = session ? session.p2_member_id : player2Id
      const winnerId = isDraw ? null : winnerKey === 'p1' ? oneId : twoId
      const opponentId = isDraw ? twoId : winnerKey === 'p1' ? twoId : oneId

      const { error } = await recordGameResult(supabase, {
        familyId,
        gameKey,
        winnerId,
        opponentId,
        isDraw,
      })
      if (error) {
        // 실패한 판은 다시 시도할 수 있게 표시를 되돌린다
        recordedRounds.current.delete(roundId)
        if (isUnknownGameKey(error))
          setErrorMsg('이 게임의 결과는 migration_17을 실행한 뒤에 저장돼요. 지금 판은 포인트에 잡히지 않아요.')
        else if (isMissingTable(error)) setNeedsMigration(true)
        else setErrorMsg('게임 결과를 저장하지 못했어요.')
        return
      }
      const gained = pointsFor(isDraw)
      setPoints((prev) => (prev === null ? prev : { ...prev, total: prev.total + gained, game: prev.game + gained }))
      channelRef.current?.send({ type: 'broadcast', event: POINTS_EVENT, payload: { points: gained } })
    },
    [supabase, familyId, player1Id, player2Id, session, currentMemberId]
  )

  useEffect(() => {
    if (chain.winner) finishRound('wordchain', chain.roundId, chain.winner)
  }, [chain.winner, chain.roundId, finishRound])

  useEffect(() => {
    if (bingo.winner) finishRound('bingo', bingo.roundId, bingo.winner)
  }, [bingo.winner, bingo.roundId, finishRound])

  useEffect(() => {
    if (stairs.winner) finishRound('stairs', stairs.roundId, stairs.winner)
  }, [stairs.winner, stairs.roundId, finishRound])

  useEffect(() => {
    if (updown.winner) finishRound('updown', updown.roundId, updown.winner)
  }, [updown.winner, updown.roundId, finishRound])

  const stateFor = useCallback(
    (key) => (key === 'wordchain' ? chain : key === 'bingo' ? bingo : key === 'stairs' ? stairs : updown),
    [chain, bingo, stairs, updown]
  )

  const setStateFor = useCallback((key, value) => {
    if (key === 'wordchain') setChain(value)
    else if (key === 'bingo') setBingo(value)
    else if (key === 'stairs') setStairs(value)
    else setUpdown(value)
  }, [])

  function newStateFor(key) {
    if (key === 'wordchain') return newWordChainState()
    if (key === 'bingo') return newBingoState()
    if (key === 'stairs') return newStairsState()
    return newUpdownState()
  }

  const refreshSessions = useCallback(async () => {
    const res = await loadSessions(supabase)
    if (res.error) {
      if (isMissingTable(res.error)) setRemoteMsg('원격 대전은 migration_16을 실행한 뒤에 쓸 수 있어요.')
      return
    }
    setSessions(res.data)
  }, [supabase])

  useEffect(() => {
    if (!familyId) return
    purgeStaleSessions(supabase).then(refreshSessions)
  }, [familyId, supabase, refreshSessions])

  // 상대가 둔 판을 받아 그대로 반영한다. 규칙은 이미 상대 화면에서 적용된 뒤라
  // 여기서는 판을 다시 계산하지 않는다.
  const applySession = useCallback(
    (row) => {
      if (!row) return
      lastSyncedRef.current = JSON.stringify(row.state)
      setSession(row)
      setActiveGame(row.game_key)
      setStateFor(row.game_key, row.state)
    },
    [setStateFor]
  )

  async function startRemote(gameKey) {
    if (!currentMemberId) return
    setRemoteBusy(true)
    // 방 만들기를 여러 번 누르면 빈 방이 줄줄이 남는다. 내 빈 방은 하나만 둔다.
    await removeMyOpenSessions(supabase, currentMemberId)
    const state = newStateFor(gameKey)
    const { data, error } = await createSession(supabase, {
      familyId,
      gameKey,
      memberId: currentMemberId,
      state,
    })
    setRemoteBusy(false)
    if (error) {
      setRemoteMsg(
        isUnknownGameKey(error)
          ? '끝말잇기 원격 대전은 migration_17을 실행한 뒤에 쓸 수 있어요.'
          : isMissingTable(error)
            ? '원격 대전은 migration_16을 실행한 뒤에 쓸 수 있어요.'
            : '방을 만들지 못했어요.'
      )
      return
    }
    setRemoteMsg('')
    applySession(data)
    channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload: { sessionId: data.session_id } })
    refreshSessions()
  }

  async function joinRemote(row) {
    setRemoteBusy(true)
    const { data, error } = await joinSession(supabase, row, currentMemberId)
    setRemoteBusy(false)
    if (error || !data) {
      setRemoteMsg('이미 다른 사람이 들어간 방이에요.')
      refreshSessions()
      return
    }
    setRemoteMsg('')
    applySession(data)
    channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload: { sessionId: data.session_id } })
  }

  async function exitRemote() {
    if (!session) return
    const role = roleOf(session, currentMemberId)
    // 방을 만든 사람이 나가면 판 자체가 없어진다. 참가자만 나가면 방은 남는다.
    if (role === 'p1') await leaveSession(supabase, session.session_id)
    const id = session.session_id
    setSession(null)
    channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload: { sessionId: id } })
    refreshSessions()
  }

  // 내 화면에서 판이 바뀌면 서버에 올리고 상대에게 알린다.
  useEffect(() => {
    if (!session) return
    const local = stateFor(session.game_key)
    if (!local) return
    const signature = JSON.stringify(local)
    // 방금 올렸거나 방금 받은 판과 내용이 같으면 아무 일도 없었다는 뜻이다.
    if (signature === lastSyncedRef.current) return
    lastSyncedRef.current = signature
    const sessionId = session.session_id
    let alive = true
    ;(async () => {
      const { data, error } = await pushState(supabase, sessionId, {
        state: local,
        turn: local.turn,
        winner: local.winner,
      })
      if (!alive) return
      if (error || !data) {
        // 못 올렸으면 서명을 되돌려, 다음 수를 둘 때 이 판까지 다시 올라가게 한다.
        lastSyncedRef.current = null
        setRemoteMsg('판을 상대에게 보내지 못했어요. 인터넷을 확인하고 한 번 더 두어보세요.')
        return
      }
      setRemoteMsg('')
      setSession(data)
      channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload: { sessionId } })
    })()
    return () => {
      alive = false
    }
  }, [chain, bingo, stairs, updown, session, supabase, stateFor])

  useEffect(() => {
    sessionRef.current = session
    applySessionRef.current = applySession
    refreshSessionsRef.current = refreshSessions
  }, [session, applySession, refreshSessions])

  const myTurn = !session || isMyTurn(session, currentMemberId)
  const remoteRole = roleOf(session, currentMemberId)

  function handleWordSubmit(e) {
    e.preventDefault()
    const raw = wordInput
    let accepted = false
    setChain((prev) => {
      if (prev.winner) return prev
      const used = prev.words.map((w) => w.word)
      const res = checkWord(raw, { lastChar: lastCharOf(used[used.length - 1]), used })
      // 규칙에 안 맞는 말은 차례를 넘기지 않는다. 오타 한 번에 지면 아이들이 억울하다.
      if (!res.ok) return { ...prev, feedback: { ok: false, reason: res.reason, word: raw.trim() } }
      accepted = true
      return {
        ...prev,
        words: [...prev.words, { who: prev.turn, word: res.word }],
        feedback: { ok: true, word: res.word, who: prev.turn },
        turn: prev.turn === 'p1' ? 'p2' : 'p1',
      }
    })
    if (accepted) setWordInput('')
  }

  // 못 이으면 스스로 넘긴다. 사전이 없으니 "막혔다"를 앱이 판정할 수 없고,
  // 시간 제한을 두면 반응속도 게임이 되어 PRD가 일부러 뺀 쪽으로 간다.
  function handleGiveUp() {
    setChain((prev) => {
      if (prev.winner) return prev
      return { ...prev, winner: prev.turn === 'p1' ? 'p2' : 'p1', endedBy: 'giveup', feedback: null }
    })
  }

  function resetChain() {
    setChain((prev) => newWordChainState(prev.winner === 'p1' ? 'p2' : 'p1'))
    setWordInput('')
  }

  function handleBingoClick(owner, idx) {
    setBingo((prev) => {
      if (prev.winner || owner !== prev.turn) return prev
      const board = prev.boards[owner]
      const cell = board[idx]
      if (cell.marked) return prev

      // 두 문제 중 어느 쪽을 풀었는지는 누른 칸이 말해준다
      const solved = prev.problems.find((q) => q.answer === cell.value)
      const correct = Boolean(solved)
      // 오답에 아무 반응이 없으면 "눌렀는데 왜 안 되지"가 된다. 맞았는지 틀렸는지는
      // 알려주되, 틀리면 차례는 넘어간다.
      const newBoard = correct ? board.map((c, i) => (i === idx ? { ...c, marked: true } : c)) : board
      const boards = { ...prev.boards, [owner]: newBoard }
      const winner = correct && checkBingoWin(newBoard) ? owner : null
      const next = owner === 'p1' ? 'p2' : 'p1'
      return {
        ...prev,
        boards,
        winner,
        feedback: correct
          ? { who: owner, ok: true, value: cell.value, text: solved.text }
          : { who: owner, ok: false, value: cell.value, answers: prev.problems.map((q) => q.answer) },
        turn: winner ? prev.turn : next,
        problems: winner ? prev.problems : bingoProblemsFor(boards[next]),
      }
    })
  }

  function handleStairsRoll() {
    setStairs((prev) => {
      if (prev.winner) return prev
      const roll = 1 + Math.floor(Math.random() * 6)
      const cur = prev.turn
      const other = cur === 'p1' ? 'p2' : 'p1'
      const rolls = prev.rolls + 1
      if (roll === 1) {
        // 모아둔 것을 잃는다. 계단에 이미 올려둔 칸은 안전하다.
        // 마지막 기회였다면 여기서 승부가 갈린다.
        const lost = { who: cur, kind: 'bust', amount: prev.pot }
        if (prev.chaseFor === cur) {
          return {
            ...prev,
            pot: 0,
            lastRoll: roll,
            bust: true,
            rolls,
            lastEvent: lost,
            winner: stairsVerdict(prev.p1, prev.p2),
          }
        }
        return { ...prev, pot: 0, lastRoll: roll, bust: true, rolls, lastEvent: lost, turn: other }
      }
      return {
        ...prev,
        pot: prev.pot + roll,
        lastRoll: roll,
        bust: false,
        rolls,
        lastEvent: { who: cur, kind: 'roll', amount: roll },
      }
    })
  }

  // 모아둔 칸을 계단에 올리고 차례를 넘긴다. 계단이 늘어나는 건 이때뿐이다.
  function handleStairsBank() {
    setStairs((prev) => {
      if (prev.winner || prev.pot === 0) return prev
      const cur = prev.turn
      const other = cur === 'p1' ? 'p2' : 'p1'
      const next = {
        ...prev,
        [cur]: prev[cur] + prev.pot,
        pot: 0,
        bust: false,
        lastEvent: { who: cur, kind: 'bank', amount: prev.pot },
      }

      // 마지막 기회를 받은 사람이 방금 멈췄다 → 점수를 비교해 끝낸다
      if (prev.chaseFor === cur) {
        return { ...next, winner: stairsVerdict(next.p1, next.p2) }
      }
      // 처음으로 목표에 닿았다 → 끝내지 않고 상대에게 마지막 한 턴을 준다
      if (next[cur] >= STAIRS_TARGET) {
        return { ...next, chaseFor: other, turn: other }
      }
      return { ...next, turn: other }
    })
  }

  function handleUpdownGuess(e) {
    e.preventDefault()
    const n = Number.parseInt(updownGuess, 10)
    if (!Number.isInteger(n)) return
    setUpdown((prev) => {
      const who = prev.turn
      const range = prev.ranges[who]
      // 범위 밖 숫자는 이미 답이 아닌 게 밝혀진 값이라, 차례를 넘기지 않고 무시한다
      if (prev.winner || n < range.low || n > range.high) return prev
      const secret = prev.secrets[who]
      if (n === secret) {
        return { ...prev, history: [...prev.history, { who, n, hint: 'hit' }], winner: who }
      }
      const tooLow = n < secret
      return {
        ...prev,
        ranges: {
          ...prev.ranges,
          [who]: { low: tooLow ? n + 1 : range.low, high: tooLow ? range.high : n - 1 },
        },
        history: [...prev.history, { who, n, hint: tooLow ? 'up' : 'down' }],
        turn: who === 'p1' ? 'p2' : 'p1',
      }
    })
    setUpdownGuess('')
  }

  function resetUpdown() {
    setUpdown((prev) => newUpdownState(prev.winner === 'p1' ? 'p2' : 'p1'))
    setUpdownGuess('')
  }

  // 원격 대전 중에는 선수가 세션에 박혀 있다. 화면의 선수 선택은 같은 기기에서
  // 번갈아 할 때만 쓰인다.
  const player1 = memberName(session ? session.p1_member_id : player1Id)
  const player2 = session
    ? session.p2_member_id
      ? memberName(session.p2_member_id)
      : '대기 중'
    : memberName(player2Id)

  const stairsName = (key) => (key === 'p1' ? player1 : player2)

  // 내가 낄 수 있는 방만. 내가 이미 그 방의 선수면 '다시 열기'(새로고침으로 화면 상태를
  // 잃었을 때 돌아가는 길), 아직 상대가 없으면 '참가하기'. 남들끼리 하는 판은 감춘다.
  // 내가 만든 방에 내가 참가하면 p1·p2가 같은 사람이 되어 혼자 두 쪽을 두게 된다.
  const myRooms = sessions.filter(
    (row) => roleOf(row, currentMemberId) || !row.p2_member_id
  )

  // 지금 이어야 하는 글자. 두음법칙으로 바꿔 시작해도 되는 글자까지 보여준다 —
  // 안 보여주면 "락으로 시작하는 말이 없다"에서 판이 멈춘다.
  const chainLast = lastCharOf(chain.words[chain.words.length - 1]?.word)
  const chainHeads = allowedHeads(chainLast)

  // 지금 숫자를 부를 사람의 범위. 원격이면 항상 차례인 쪽이 곧 나다.
  const updownRange = updown.ranges[updown.turn]

  const activeState =
    activeGame === 'wordchain' ? chain : activeGame === 'bingo' ? bingo : activeGame === 'stairs' ? stairs : updown

  const onlineMembers = useMemo(
    () => members.filter((m) => onlineIds.includes(m.member_id)),
    [members, onlineIds]
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150" aria-label="처음으로">
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <div className="w-10"></div>
      </div>

      <div className="bg-surface border border-border rounded-md px-4 py-3 mb-6 shadow-soft">
        <p className="font-display font-bold text-[15px] text-secondary flex items-center gap-2">
          <i className="ph-duotone ph-house-line text-lg" aria-hidden="true"></i>가족 아지트 (채팅 &amp; 게임)
        </p>
        <p className="text-foreground-muted text-[13px] leading-[18px] mt-1">부모님이 잠깐 자리를 비워도 가족끼리 대화하고 같이 놀 수 있어요.</p>
      </div>

      {needsMigration && (
        <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4">
          <p className="text-[13px] text-destructive leading-[19px]">
            아지트 테이블이 아직 없어요. Supabase SQL Editor에서 <strong>migration_05_family_room.sql</strong>을 실행해주세요.
          </p>
        </div>
      )}
      {errorMsg && !needsMigration && <p className="text-[13px] text-destructive mb-4">{errorMsg}</p>}

      <div className="relative bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-6">
        <span className="absolute -top-2 right-4 w-11 h-4 bg-tape-pink/90 rotate-[5deg] rounded-sm" aria-hidden="true"></span>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-bold text-[15px] flex items-center gap-2">
            <i className="ph-duotone ph-chats-circle text-xl text-primary"></i>우리 가족 톡
          </p>
          {/* 접속 중인 사람만 진하게 — Presence로 실제 상태를 보여준다 */}
          <div className="flex items-center -space-x-2">
            {members.slice(0, 4).map((m) => {
              const online = onlineIds.includes(m.member_id)
              return (
                <span
                  key={m.member_id}
                  title={`${m.name}${online ? ' · 접속 중' : ''}`}
                  className={`w-7 h-7 rounded-full ${MEMBER_BG_CLASS[colorTokenForMember(members, m.member_id)]} ring-2 ring-surface shadow-soft flex items-center justify-center text-[14px] ${
                    online ? '' : 'opacity-35 grayscale'
                  }`}
                >
                  <span aria-hidden="true">{characterOf(m)}</span>
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[12px] text-foreground-muted min-w-0">
            {onlineMembers.length > 0
              ? `지금 ${onlineMembers.map((m) => m.name).join(', ')} 접속 중`
              : '지금 접속 중인 가족이 없어요'}
          </p>
        </div>
        <div className="border-t border-dashed border-border mb-3" aria-hidden="true"></div>
        {/* 지워지는 규칙을 적어두지 않으면 "어제 얘기가 왜 없지"가 된다 */}
        <p className="text-[11px] text-foreground-muted mb-2">대화는 7일이 지나면 자동으로 지워져요.</p>
        <div ref={chatLogRef} className="flex flex-col gap-3 max-h-64 overflow-y-auto mb-3 pr-1">
          {chatLoading ? (
            <p className="text-foreground-muted text-[14px]">대화를 불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p className="text-foreground-muted text-[14px]">아직 대화가 없어요. 먼저 말을 걸어보세요.</p>
          ) : (
            messages.map((m) => {
              const time = formatChatTime(m.created_at)
              const token = colorTokenForMember(members, m.member_id)
              return (
                <div key={m.message_id} className="flex items-start gap-2">
                  <span
                    className={`w-7 h-7 rounded-full ${MEMBER_BG_CLASS[token]} ring-2 ring-surface shadow-soft flex items-center justify-center text-[14px] shrink-0`}
                  >
                    <span aria-hidden="true">
                      {characterOf(members.find((x) => x.member_id === m.member_id)) }
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-display font-bold text-foreground-muted mb-1">{m.sender_name}</p>
                    <div className="inline-block bg-tape-yellow/70 rounded-lg rounded-tl-none px-3 py-2 max-w-full">
                      <p className="text-[14px] leading-[20px] text-foreground break-words">{m.content}</p>
                    </div>
                    {time && <p className="text-[11px] text-foreground-muted mt-1">{time}</p>}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
          {/* 예전에는 아무나 발신자를 골라 다른 사람 이름으로 말할 수 있었다.
              지금 앱을 쓰는 사람으로 고정한다 — 홈에서 누구로 들어왔는지가 곧 발신자다. */}
          <span
            className="flex items-center gap-1.5 bg-surface-muted rounded-full pl-2 pr-3 py-2 text-[13px] font-display font-bold border border-border shrink-0"
            title="홈에서 고른 사람으로 보내요"
          >
            <span className="text-[15px]" aria-hidden="true">
              {characterOf(members.find((m) => m.member_id === chatSenderId))}
            </span>
            {memberName(chatSenderId)}
          </span>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메시지를 입력"
            maxLength={500}
            className="flex-1 bg-surface-muted rounded-full px-4 py-2.5 text-[14px] border border-border outline-none min-w-0"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 active:scale-90 transition duration-150 disabled:opacity-60"
            aria-label="보내기"
          >
            <i className="ph-bold ph-paper-plane-right text-base"></i>
          </button>
        </form>
      </div>

      <div className="relative bg-foreground border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-4 rotate-[-1deg]">
        <span className="absolute -top-2 left-6 w-11 h-4 bg-tape-yellow/90 rotate-[-4deg] rounded-sm" aria-hidden="true"></span>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display font-bold text-[15px] flex items-center gap-2 text-on-primary">
            <i className="ph-duotone ph-game-controller text-xl text-tape-yellow"></i>미니게임존
          </p>
          <span className="bg-tape-yellow text-foreground font-display font-bold text-[12px] rounded-full px-3 py-1 whitespace-nowrap">
            가족 포인트: {points === null ? '-' : points.total.toLocaleString('ko-KR')}p
          </span>
        </div>
        <p className="text-[13px] text-white/70 mt-2">
          한 판 이기면 10p, 비기면 5p, 할일을 하나 끝내면 {TODO_POINT}p가 쌓여요.
        </p>
        {points !== null && (
          <p className="text-[12px] text-white/60 mt-1">
            게임 {points.game.toLocaleString('ko-KR')}p · 할일 {points.todo.toLocaleString('ko-KR')}p
          </p>
        )}
      </div>

      <FamilyRewards points={points?.total ?? null} />

      <div className="relative bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding">
        <p className="font-display font-bold text-[15px] mb-3 flex items-center gap-2">
          <i className="ph-duotone ph-users-three text-xl text-accent"></i>선수 선택 · 턴제 대전
        </p>

        {/* 원격 대전. 방을 만들면 상대가 자기 기기에서 참가한다. */}
        <div className="bg-surface-muted rounded-md px-3 py-3 mb-4">
          {session ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="font-display font-bold text-[13px]">
                  원격 대전 · {GAME_TABS.find((t) => t.key === session.game_key)?.label}
                </p>
                <button
                  type="button"
                  onClick={exitRemote}
                  className="text-[12px] font-display font-bold text-foreground-muted shrink-0 active:scale-95 transition duration-150"
                >
                  나가기
                </button>
              </div>
              <p className="text-[12px] text-foreground-muted leading-[18px]">
                {!session.p2_member_id
                  ? '상대가 참가하기를 누르면 시작해요.'
                  : session.winner
                    ? '판이 끝났어요. 새 게임을 누르면 다시 시작해요.'
                    : myTurn
                      ? '내 차례예요.'
                      : `${memberName(session.turn === 'p1' ? session.p1_member_id : session.p2_member_id)}의 차례예요.`}
              </p>
              <p className="text-[12px] text-foreground-muted mt-1">
                {memberName(session.p1_member_id)}
                {session.p2_member_id ? ` vs ${memberName(session.p2_member_id)}` : ' vs 대기 중'}
                {remoteRole ? '' : ' · 구경 중'}
              </p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-[13px] mb-1.5">따로 있는 가족과 하기</p>
              <p className="text-[12px] text-foreground-muted leading-[18px] mb-2">
                방을 만들면 다른 기기에서 참가할 수 있어요. 아무것도 만들지 않으면 지금처럼 한 기기에서 번갈아 해요.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {GAME_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => startRemote(t.key)}
                    disabled={remoteBusy || !currentMemberId}
                    className="bg-surface border border-border rounded-full px-3 py-1.5 text-[12px] font-display font-bold active:scale-95 transition duration-150 disabled:opacity-60"
                  >
                    {t.label} 방 만들기
                  </button>
                ))}
              </div>
              {/* 남이 하고 있는 판을 구경만 하는 '보기'는 없앴다 — 열어도 아무것도
                  누를 수 없어서 화면이 멈춘 것처럼 보였다. 목록에는 내가 실제로
                  낄 수 있는 방만 남긴다: 기다리는 방, 그리고 내가 하던 방. */}
              {myRooms.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {myRooms.map((row) => {
                    const mine = roleOf(row, currentMemberId)
                    return (
                      <li key={row.session_id} className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-foreground-muted min-w-0">
                          {mine ? '내가 하던 ' : `${memberName(row.p1_member_id)}의 `}
                          {GAME_TABS.find((t) => t.key === row.game_key)?.label}
                          {mine && row.p2_member_id
                            ? ` · ${memberName(mine === 'p1' ? row.p2_member_id : row.p1_member_id)}와 대전 중`
                            : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => (mine ? applySession(row) : joinRemote(row))}
                          disabled={remoteBusy}
                          className="text-[12px] font-display font-bold text-primary shrink-0 active:scale-95 transition duration-150 disabled:opacity-60"
                        >
                          {mine ? '다시 열기' : '참가하기'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-[11px] text-foreground-muted mt-2">
                방은 마지막으로 둔 뒤 2시간이 지나면 저절로 사라져요. 목록이 쌓이지 않아요.
              </p>
            </>
          )}
          {remoteMsg && <p className="text-[12px] text-destructive mt-2 leading-[18px]">{remoteMsg}</p>}
        </div>

        {/* 선수 줄이 곧 차례 표시다. 원격 대전에서는 선수가 세션에 박혀 있어서
            고를 수 있는 값이 아니다 — 예전에는 눌리지 않는 select가 남아 있어서
            대전 상대와 다른 이름이 그대로 보였다. */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {['p1', 'p2'].map((key) => {
            const memberId = session
              ? key === 'p1'
                ? session.p1_member_id
                : session.p2_member_id
              : key === 'p1'
                ? player1Id
                : player2Id
            const waiting = Boolean(session) && !memberId
            const isTurn = !activeState.winner && activeState.turn === key && !waiting
            const isMe = Boolean(memberId) && memberId === currentMemberId
            const won = activeState.winner === key
            return (
              <div
                key={key}
                className={`rounded-md border-2 px-2.5 py-2 transition duration-150 ${
                  won
                    ? 'border-foreground bg-secondary-dark text-on-secondary shadow-sticker'
                    : isTurn
                      ? isMe
                        ? 'border-foreground bg-primary text-on-primary shadow-sticker'
                        : 'border-foreground bg-pastel-sky'
                      : 'border-border bg-surface-muted'
                }`}
              >
                <p className="text-[11px] font-display font-bold opacity-80">
                  {key === 'p1' ? '선수1' : '선수2'}
                  {won ? ' · 승리!' : isTurn ? (isMe ? ' · 내 차례!' : ' · 지금 차례') : ''}
                </p>
                {session ? (
                  <p className="font-display font-bold text-[14px] truncate">
                    {waiting ? (
                      '참가를 기다려요'
                    ) : (
                      <>
                        <span aria-hidden="true">
                          {characterOf(members.find((m) => m.member_id === memberId))}
                        </span>{' '}
                        {memberName(memberId)}
                      </>
                    )}
                  </p>
                ) : (
                  <select
                    value={memberId}
                    onChange={(e) => (key === 'p1' ? setPlayer1Id(e.target.value) : setPlayer2Id(e.target.value))}
                    className="w-full bg-surface rounded-md px-1.5 py-1 text-[13px] font-display font-bold text-foreground border border-border outline-none"
                  >
                    {members.map((m) => (
                      <option key={m.member_id} value={m.member_id}>
                        {characterOf(m)} {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => !session && setActiveGame(tab.key)}
              disabled={Boolean(session) && session.game_key !== tab.key}
              className={`game-tab relative flex flex-col items-start gap-1 ${tab.bgClass} border border-border rounded-md p-3 text-left transition duration-150`}
              data-active={activeGame === tab.key}
            >
              <span className="game-tab-dot absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-border" aria-hidden="true"></span>
              <i className={`ph-bold ${tab.icon} text-xl text-foreground`} aria-hidden="true"></i>
              <span className="font-display font-bold text-[13px] text-foreground">{tab.label}</span>
              <span className="text-[11px] text-foreground-muted leading-tight">{tab.sub}</span>
            </button>
          ))}
        </div>

        {activeGame === 'wordchain' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">
              앞 사람이 말한 낱말의 <strong>끝 글자</strong>로 시작하는 낱말을 번갈아 말해요. 두 글자 이상, 이미 나온 낱말은
              안 돼요. 더 이을 말이 없으면 <strong>모르겠어요</strong>를 눌러요 — 그러면 상대가 승리!
            </p>

            <div className="bg-surface-muted rounded-md px-4 py-3 text-center mb-3">
              <p className="text-[13px] text-foreground-muted">이 글자로 시작하는 낱말</p>
              <p className="font-display font-extrabold text-[32px] leading-tight">
                {chainHeads.join(' 또는 ')}
              </p>
              {chainHeads.length > 1 && (
                <p className="text-[12px] text-foreground-muted">둘 중 아무 글자로 시작해도 돼요</p>
              )}
            </div>

            {chain.feedback && !chain.winner && (
              <p
                className={`text-[13px] font-display font-bold text-center mb-3 ${
                  chain.feedback.ok ? 'text-secondary' : 'text-destructive'
                }`}
              >
                {chain.feedback.ok
                  ? `${chain.feedback.who === 'p1' ? player1 : player2}: ${chain.feedback.word} 좋아요!`
                  : chain.feedback.reason === 'head'
                    ? `${chainHeads.join(' 또는 ')}(으)로 시작해야 해요.`
                    : chain.feedback.reason === 'used'
                      ? `${chain.feedback.word}은(는) 이미 나온 낱말이에요.`
                      : chain.feedback.reason === 'short'
                        ? '두 글자 이상으로 말해주세요.'
                        : '한글 낱말로 말해주세요.'}
              </p>
            )}

            <form onSubmit={handleWordSubmit} className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                disabled={!!chain.winner || !myTurn}
                placeholder={`${chainHeads[0] || ''}...으로 시작하는 낱말`}
                className="flex-1 bg-surface rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150 min-w-0"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!!chain.winner || !myTurn}
                className="px-4 h-11 rounded-md bg-primary text-on-primary border-2 border-foreground shadow-sticker font-display font-bold text-[14px] shrink-0 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
              >
                말하기
              </button>
            </form>

            <ul className="flex flex-col gap-1.5 mb-3 max-h-40 overflow-y-auto pr-1">
              {chain.words.map((w, i) => (
                <li key={i} className="flex items-center justify-between bg-surface-muted rounded-md px-3 py-1.5">
                  <span className="text-[14px] font-display font-bold">{w.word}</span>
                  <span className="text-[12px] text-foreground-muted">
                    {w.who === 'seed' ? '시작 낱말' : w.who === 'p1' ? player1 : player2}
                  </span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleGiveUp}
              disabled={!!chain.winner || !myTurn}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] mb-2 active:scale-[0.97] transition duration-150 disabled:opacity-50"
            >
              더 이을 말이 없어요 (모르겠어요)
            </button>

            <p className="text-[12px] text-foreground-muted text-center mb-3">
              실제로 있는 낱말인지는 가족이 함께 판단해요. 앱은 끝 글자·글자 수·중복만 확인해요.
            </p>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {chain.winner
                ? `${chain.winner === 'p1' ? player1 : player2} 승리! ${chain.words.length - 1}개까지 이었어요.`
                : ' '}
            </p>
            <button
              type="button"
              onClick={resetChain}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'bingo' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">
              내 차례에 문제가 <strong>두 개</strong> 나와요. 둘 중 <strong>원하는 쪽</strong>을 풀어서, 내 판에서 그 정답 칸을
              눌러요. 내 줄에 필요한 칸을 골라 뚫는 게 요령! 먼저 한 줄을 완성하면 승리해요.
            </p>
            <p className="text-[13px] text-foreground-muted text-center mb-2">
              {bingo.winner ? '문제' : `${bingo.turn === 'p1' ? player1 : player2}의 문제 — 둘 중 하나만 풀면 돼요`}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(bingo.winner ? [] : bingo.problems).map((q, i) => (
                <div key={i} className="bg-surface-muted rounded-md px-3 py-3 text-center">
                  <p className="font-display font-extrabold text-[24px]">{q.text}</p>
                </div>
              ))}
              {bingo.winner && (
                <div className="col-span-2 bg-surface-muted rounded-md px-3 py-3 text-center">
                  <p className="font-display font-extrabold text-[24px]">-</p>
                </div>
              )}
            </div>

            {bingo.feedback && !bingo.winner && (
              <p
                className={`text-[13px] font-display font-bold text-center mb-3 ${
                  bingo.feedback.ok ? 'text-secondary' : 'text-destructive'
                }`}
              >
                {bingo.feedback.ok
                  ? `${bingo.feedback.who === 'p1' ? player1 : player2}: ${bingo.feedback.text} = ${bingo.feedback.value} 정답! 칸을 뚫었어요.`
                  : `${bingo.feedback.who === 'p1' ? player1 : player2}: ${bingo.feedback.value}은(는) 아니에요. 정답은 ${bingo.feedback.answers.join(' 또는 ')}였어요.`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 mb-3">
              {['p1', 'p2'].map((key) => (
                <div key={key}>
                  <p className={`text-[12px] font-display font-bold text-center mb-1 ${key === bingo.turn && !bingo.winner ? 'text-primary' : 'text-foreground-muted'}`}>
                    {key === 'p1' ? player1 : player2}
                    {key === bingo.turn && !bingo.winner ? ' · 이 판을 뚫어요' : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {bingo.boards[key].map((cell, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleBingoClick(key, idx)}
                        disabled={!!bingo.winner || key !== bingo.turn || cell.marked || !myTurn}
                        data-marked={cell.marked}
                        className="bingo-cell bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-95 transition duration-150 disabled:opacity-50"
                      >
                        {cell.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {bingo.winner ? `${bingo.winner === 'p1' ? player1 : player2} 승리! 한 줄을 완성했어요.` : ' '}
            </p>
            <button
              type="button"
              onClick={() => setBingo((prev) => newBingoState(prev.winner === 'p1' ? 'p2' : 'p1'))}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'stairs' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">
              주사위를 굴려 모으고, <strong>멈추면</strong> 모은 만큼 계단을 올라가요. 욕심내서 계속 굴리다가{' '}
              <strong>1</strong>이 나오면 모아둔 걸 전부 잃어요. 얼마든지 계속 굴릴 수 있으니 언제 멈출지가 승부예요.
              누가 {STAIRS_TARGET}칸에 닿으면 상대도 마지막 한 턴을 받아요. 그 뒤 더 높이 오른 사람이 승리!
            </p>

            {stairs.chaseFor && !stairs.winner && (
              <p className="text-[13px] font-display font-bold text-accent text-center mb-3">
                마지막 기회! {stairs.chaseFor === 'p1' ? player1 : player2}이(가) 넘어야 해요.
              </p>
            )}

            {/* 1이 나와 차례가 넘어가는 순간이 두 기기 모두에서 분명히 보여야 한다.
                숫자만 조용히 바뀌면 상대는 자기 차례가 온 걸 모르고 기다린다. */}
            {stairs.lastEvent && !stairs.winner && (
              <p
                className={`text-[13px] font-display font-bold text-center mb-2 ${
                  stairs.lastEvent.kind === 'bust' ? 'text-destructive' : 'text-foreground-muted'
                }`}
              >
                {stairs.lastEvent.kind === 'bust'
                  ? stairs.lastEvent.amount > 0
                    ? `${stairsName(stairs.lastEvent.who)}이(가) 1을 굴렸어요! 모아둔 ${stairs.lastEvent.amount}칸을 잃고 차례가 넘어갔어요.`
                    : `${stairsName(stairs.lastEvent.who)}이(가) 1을 굴렸어요! 한 칸도 못 모으고 차례가 넘어갔어요.`
                  : stairs.lastEvent.kind === 'bank'
                    ? `${stairsName(stairs.lastEvent.who)}이(가) ${stairs.lastEvent.amount}칸을 쌓고 멈췄어요.`
                    : `${stairsName(stairs.lastEvent.who)}이(가) ${stairs.lastEvent.amount}을(를) 굴렸어요.`}
              </p>
            )}

            <div className="flex flex-col gap-3 mb-3">
              {['p1', 'p2'].map((key) => {
                const pct = Math.min(100, Math.round((stairs[key] / STAIRS_TARGET) * 100))
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-[13px] font-display font-bold mb-1">
                      <span>{key === 'p1' ? player1 : player2}</span>
                      <span>
                        {stairs[key]} / {STAIRS_TARGET}
                      </span>
                    </div>
                    <div className="h-3 bg-surface-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${key === 'p1' ? 'bg-primary' : 'bg-accent'} rounded-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* 숫자만 오르던 화면에 실제 주사위를 놓는다 */}
            <div className="flex items-center justify-center gap-4 bg-surface-muted rounded-md py-4 mb-3">
              <i
                key={`${stairs.lastRoll}-${stairs.pot}`}
                className={`ph-fill ${DICE_ICON[stairs.lastRoll] || 'ph-dice-five'} text-[56px] ${
                  stairs.lastRoll ? 'text-foreground' : 'text-foreground-muted opacity-40'
                } ${rolling ? 'dice-rolling' : ''}`}
                aria-hidden="true"
              ></i>
              <div>
                <p className="text-[12px] text-foreground-muted">모아둔 칸</p>
                <p className="font-display font-extrabold text-[28px] leading-none">{stairs.pot}</p>
                <p className="text-[12px] text-foreground-muted mt-1">
                  {stairs.bust
                    ? '1이 나왔어요'
                    : stairs.pot > 0
                      ? '멈추면 내 계단에 쌓여요'
                      : '굴려서 모아보세요'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={handleStairsRoll}
                disabled={!!stairs.winner || !myTurn}
                className="bg-primary text-on-primary rounded-md py-3 flex items-center justify-center gap-2 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
              >
                <i className="ph-bold ph-dice-five"></i>한 번 더
              </button>
              <button
                type="button"
                onClick={handleStairsBank}
                disabled={!!stairs.winner || stairs.pot === 0 || !myTurn}
                className="bg-secondary-dark text-on-secondary rounded-md py-3 flex items-center justify-center gap-2 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150 disabled:opacity-40"
              >
                <i className="ph-bold ph-hand-palm"></i>멈추기
              </button>
            </div>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {stairs.winner
                ? stairs.winner === 'draw'
                  ? `무승부! 둘 다 ${stairs.p1}칸이에요.`
                  : `${stairs.winner === 'p1' ? player1 : player2} 승리! ${stairs.p1}칸 대 ${stairs.p2}칸.`
                : ' '}
            </p>
            <button
              type="button"
              onClick={() => setStairs((prev) => newStairsState(prev.winner === 'p1' ? 'p2' : 'p1'))}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'updown' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">
              둘이 <strong>각자 다른</strong> 숨은 숫자(1~100)를 받았어요. 번갈아 자기 숫자를 불러 맞히고, 틀리면 업/다운 힌트로
              내 범위가 좁아져요. 자기 숫자를 <strong>먼저</strong> 맞힌 사람이 승리!
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {['p1', 'p2'].map((key) => (
                <div
                  key={key}
                  className={`bg-surface-muted rounded-md px-3 py-2.5 text-center ${
                    key === updown.turn && !updown.winner ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <p className="text-[12px] text-foreground-muted">
                    {key === 'p1' ? player1 : player2}의 남은 범위
                  </p>
                  <p className="font-display font-extrabold text-[20px]">
                    {updown.ranges[key].low} ~ {updown.ranges[key].high}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleUpdownGuess} className="flex items-center gap-2 mb-3">
              <input
                type="number"
                inputMode="numeric"
                value={updownGuess}
                onChange={(e) => setUpdownGuess(e.target.value)}
                min={updownRange.low}
                max={updownRange.high}
                disabled={!!updown.winner || !myTurn}
                placeholder={`${updownRange.low}~${updownRange.high} 사이의 숫자`}
                className="flex-1 bg-surface rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150 min-w-0"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!!updown.winner || !myTurn}
                className="px-4 h-11 rounded-md bg-primary text-on-primary border-2 border-foreground shadow-sticker font-display font-bold text-[14px] shrink-0 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
              >
                말하기
              </button>
            </form>

            {updown.history.length > 0 && (
              <ul className="flex flex-col gap-1.5 mb-3 max-h-32 overflow-y-auto pr-1">
                {updown.history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between bg-surface-muted rounded-md px-3 py-1.5">
                    <span className="text-[13px] font-display font-bold">
                      {h.who === 'p1' ? player1 : player2} · {h.n}
                    </span>
                    <span
                      className={`text-[12px] font-display font-bold ${
                        h.hint === 'hit' ? 'text-secondary' : h.hint === 'up' ? 'text-primary' : 'text-accent'
                      }`}
                    >
                      {h.hint === 'hit' ? '정답!' : h.hint === 'up' ? '업 ↑' : '다운 ↓'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[14px] font-display font-bold text-center mb-3">
              {updown.winner
                ? `${updown.winner === 'p1' ? player1 : player2} 승리! 숨은 숫자는 ${updown.secrets[updown.winner]}이었어요.`
                : ' '}
            </p>
            <button
              type="button"
              onClick={resetUpdown}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}
      </div>

      <div className="flex-1"></div>
    </>
  )
}

export default FamilyRoomScreen
