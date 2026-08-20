import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { MEMBER_BG_CLASS, colorTokenForMember } from '../lib/memberColors'
import FamilyRewards from '../components/FamilyRewards'
import { characterOf } from '../lib/avatars'
import { currentSubscription, disablePush, enablePush, notifyFamily, pushSupported } from '../lib/push'
import {
  GAME_EVENT,
  createSession,
  fetchSession,
  isMyTurn,
  joinSession,
  leaveSession,
  loadSessions,
  pushState,
  roleOf,
} from '../lib/gameSession'
import {
  CHAT_EVENT,
  POINTS_EVENT,
  familyChannelName,
  isMissingTable,
  loadChat,
  loadPoints,
  TODO_POINT,
  pointsFor,
  recordGameResult,
  sendChat,
} from '../lib/familyRoom'

const GAME_TABS = [
  { key: 'sum15', label: '합이 15', sub: '숫자 3개로 15 만들기', icon: 'ph-hash', bgClass: 'bg-pastel-mint' },
  { key: 'bingo', label: '계산 빙고', sub: '암산으로 한 줄 빙고', icon: 'ph-grid-four', bgClass: 'bg-pastel-sky' },
  { key: 'stairs', label: '계단 오르기', sub: '주사위로 먼저 도착하기', icon: 'ph-flag-checkered', bgClass: 'bg-tape-pink/25' },
  { key: 'updown', label: '숫자 맞히기', sub: '업다운으로 범위 좁히기', icon: 'ph-arrows-down-up', bgClass: 'bg-tape-yellow/25' },
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

function hasSum15(arr) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      for (let k = j + 1; k < arr.length; k++)
        if (arr[i] + arr[j] + arr[k] === 15) return true
  return false
}

function newSum15State() {
  return { roundId: nextRoundId++, owners: {}, p1Nums: [], p2Nums: [], turn: 'p1', winner: null }
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
function bingoProblemFor(board) {
  const open = board.filter((c) => !c.marked)
  const pool = open.length ? open : board
  const answer = pool[Math.floor(Math.random() * pool.length)].value

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

function checkBingoWin(board) {
  return BINGO_LINES.some((line) => line.every((i) => board[i].marked))
}

function newBingoState() {
  const boards = { p1: makeBingoBoard(), p2: makeBingoBoard() }
  return {
    roundId: nextRoundId++,
    boards,
    turn: 'p1',
    winner: null,
    problem: bingoProblemFor(boards.p1),
    feedback: null,
  }
}

const DICE_ICON = ['', 'ph-dice-one', 'ph-dice-two', 'ph-dice-three', 'ph-dice-four', 'ph-dice-five', 'ph-dice-six']

// 예전 계단 오르기는 "굴린다 → 그만큼 올라간다"가 전부여서 이길지 질지가 전부 운이었고,
// 플레이어가 할 결정이 하나도 없었다. 굴린 눈을 바로 올리지 않고 '모아둔 칸'에 쌓아,
// 한 번 더 굴릴지 여기서 멈출지 고르게 한다. 1이 나오면 모아둔 것을 전부 잃는다.
// 한 턴에 모을 수 있는 상한. 이게 없으면 1만 피하면 계속 굴릴 수 있어서, 먼저 시작한
// 사람이 첫 턴에 30칸을 다 모아 상대가 한 번도 못 해보고 끝나는 판이 나온다
// (1이 안 나올 확률이 매번 5/6이라 여덟 번 연속 성공이 약 23%다).
const STAIRS_MAX_POT = 10

function newStairsState() {
  return {
    roundId: nextRoundId++,
    p1: 0,
    p2: 0,
    pot: 0,
    lastRoll: null,
    bust: false,
    turn: 'p1',
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

function newUpdownState() {
  return {
    roundId: nextRoundId++,
    // 한 기기에서 번갈아 하는 방식이라 정답을 상태에 두는 것 이상으로 숨길 방법은 없다.
    // 화면에 그리지 않는 선까지가 한계다.
    secret: UPDOWN_MIN + Math.floor(Math.random() * (UPDOWN_MAX - UPDOWN_MIN + 1)),
    low: UPDOWN_MIN,
    high: UPDOWN_MAX,
    history: [],
    turn: 'p1',
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
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const chatLogRef = useRef(null)
  const channelRef = useRef(null)

  const [points, setPoints] = useState(null)

  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [activeGame, setActiveGame] = useState('sum15')

  const [sum15, setSum15] = useState(newSum15State)
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
  // 받은 판을 다시 서버로 되쏘지 않기 위한 표시. 없으면 두 기기가 서로 밀어내며 무한히 돈다.
  const applyingRemote = useRef(false)
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
    currentSubscription().then((sub) => setPushOn(Boolean(sub)))
  }, [])

  useEffect(() => {
    if (!rolling) return
    const t = setTimeout(() => setRolling(false), 400)
    return () => clearTimeout(t)
  }, [rolling])

  // 초기 로드 — 대화 기록과 지금까지 쌓인 포인트
  useEffect(() => {
    if (!familyId) return
    let alive = true
    ;(async () => {
      const [chat, pts] = await Promise.all([loadChat(supabase), loadPoints(supabase)])
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
  }, [supabase, familyId])

  // 할일 점수는 완료 상태에서 계산하므로, 할일이 바뀌면 여기서도 다시 읽어야 한다.
  const refreshPoints = useCallback(async () => {
    const pts = await loadPoints(supabase)
    if (!pts.error) setPoints(pts.data)
  }, [supabase])

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

  async function togglePush() {
    if (pushBusy) return
    setPushBusy(true)
    setPushMsg('')
    if (pushOn) {
      await disablePush(supabase)
      setPushOn(false)
      setPushBusy(false)
      return
    }
    const res = await enablePush(supabase, { familyId, memberId: currentMemberId })
    setPushBusy(false)
    if (res.ok) {
      setPushOn(true)
      return
    }
    if (res.error === 'unsupported') setPushMsg('이 브라우저는 휴대폰 알림을 지원하지 않아요.')
    else if (res.error === 'denied') setPushMsg('브라우저에서 알림이 차단되어 있어요. 주소창 옆 자물쇠에서 허용으로 바꿔주세요.')
    else if (res.error === 'no_key') setPushMsg('서버에 푸시 키가 설정되지 않았어요.')
    else if (res.error === 'save_failed') setPushMsg('알림 등록을 저장하지 못했어요. migration_14를 실행했는지 확인해주세요.')
    else setPushMsg('알림을 켜지 못했어요.')
  }

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
        if (isMissingTable(error)) setNeedsMigration(true)
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
    if (sum15.winner) finishRound('sum15', sum15.roundId, sum15.winner)
  }, [sum15.winner, sum15.roundId, finishRound])

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
    (key) => (key === 'sum15' ? sum15 : key === 'bingo' ? bingo : key === 'stairs' ? stairs : updown),
    [sum15, bingo, stairs, updown]
  )

  const setStateFor = useCallback((key, value) => {
    if (key === 'sum15') setSum15(value)
    else if (key === 'bingo') setBingo(value)
    else if (key === 'stairs') setStairs(value)
    else setUpdown(value)
  }, [])

  function newStateFor(key) {
    if (key === 'sum15') return newSum15State()
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
    if (familyId) refreshSessions()
  }, [familyId, refreshSessions])

  // 상대가 둔 판을 받아 그대로 반영한다. 규칙은 이미 상대 화면에서 적용된 뒤라
  // 여기서는 판을 다시 계산하지 않는다.
  const applySession = useCallback(
    (row) => {
      if (!row) return
      applyingRemote.current = true
      setSession(row)
      setActiveGame(row.game_key)
      setStateFor(row.game_key, row.state)
    },
    [setStateFor]
  )

  async function startRemote(gameKey) {
    if (!currentMemberId) return
    setRemoteBusy(true)
    const state = newStateFor(gameKey)
    const { data, error } = await createSession(supabase, {
      familyId,
      gameKey,
      memberId: currentMemberId,
      state,
    })
    setRemoteBusy(false)
    if (error) {
      setRemoteMsg(isMissingTable(error) ? '원격 대전은 migration_16을 실행한 뒤에 쓸 수 있어요.' : '방을 만들지 못했어요.')
      return
    }
    setRemoteMsg('')
    setSession(data)
    setActiveGame(gameKey)
    setStateFor(gameKey, state)
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
    if (applyingRemote.current) {
      applyingRemote.current = false
      return
    }
    const local = stateFor(session.game_key)
    if (!local || local === session.state) return
    let alive = true
    ;(async () => {
      const { data } = await pushState(supabase, session.session_id, {
        state: local,
        turn: local.turn,
        winner: local.winner,
      })
      if (!alive || !data) return
      setSession(data)
      channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload: { sessionId: data.session_id } })
    })()
    return () => {
      alive = false
    }
  }, [sum15, bingo, stairs, updown, session, supabase, stateFor])

  useEffect(() => {
    sessionRef.current = session
    applySessionRef.current = applySession
    refreshSessionsRef.current = refreshSessions
  }, [session, applySession, refreshSessions])

  const myTurn = !session || isMyTurn(session, currentMemberId)
  const remoteRole = roleOf(session, currentMemberId)

  function handleSum15Pick(n) {
    setSum15((prev) => {
      if (prev.owners[n] || prev.winner) return prev
      const owners = { ...prev.owners, [n]: prev.turn }
      const numsKey = prev.turn === 'p1' ? 'p1Nums' : 'p2Nums'
      const nums = [...prev[numsKey], n]
      let winner = null
      if (nums.length >= 3 && hasSum15(nums)) winner = prev.turn
      else if (Object.keys(owners).length === 9) winner = 'draw'
      return { ...prev, owners, [numsKey]: nums, winner, turn: winner ? prev.turn : prev.turn === 'p1' ? 'p2' : 'p1' }
    })
  }

  function handleBingoClick(owner, idx) {
    setBingo((prev) => {
      if (prev.winner || owner !== prev.turn) return prev
      const board = prev.boards[owner]
      const cell = board[idx]
      if (cell.marked) return prev

      const correct = cell.value === prev.problem.answer
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
        feedback: correct ? { ok: true, value: cell.value } : { ok: false, value: cell.value, answer: prev.problem.answer },
        turn: winner ? prev.turn : next,
        problem: winner ? prev.problem : bingoProblemFor(boards[next]),
      }
    })
  }

  function handleStairsRoll() {
    setStairs((prev) => {
      if (prev.winner || prev.pot >= STAIRS_MAX_POT) return prev
      const roll = 1 + Math.floor(Math.random() * 6)
      const cur = prev.turn
      const other = cur === 'p1' ? 'p2' : 'p1'
      if (roll === 1) {
        // 모아둔 것을 잃는다. 계단에 이미 올려둔 칸은 안전하다.
        // 마지막 기회였다면 여기서 승부가 갈린다.
        if (prev.chaseFor === cur) {
          return { ...prev, pot: 0, lastRoll: roll, bust: true, winner: stairsVerdict(prev.p1, prev.p2) }
        }
        return { ...prev, pot: 0, lastRoll: roll, bust: true, turn: other }
      }
      return { ...prev, pot: Math.min(prev.pot + roll, STAIRS_MAX_POT), lastRoll: roll, bust: false }
    })
    setRolling(true)
  }

  // 모아둔 칸을 계단에 올리고 차례를 넘긴다. 계단이 늘어나는 건 이때뿐이다.
  function handleStairsBank() {
    setStairs((prev) => {
      if (prev.winner || prev.pot === 0) return prev
      const cur = prev.turn
      const other = cur === 'p1' ? 'p2' : 'p1'
      const next = { ...prev, [cur]: prev[cur] + prev.pot, pot: 0, bust: false }

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
      // 범위 밖 숫자는 이미 답이 아닌 게 밝혀진 값이라, 차례를 넘기지 않고 무시한다
      if (prev.winner || n < prev.low || n > prev.high) return prev
      const who = prev.turn
      if (n === prev.secret) {
        return { ...prev, history: [...prev.history, { who, n, hint: 'hit' }], winner: who }
      }
      const tooLow = n < prev.secret
      return {
        ...prev,
        low: tooLow ? n + 1 : prev.low,
        high: tooLow ? prev.high : n - 1,
        history: [...prev.history, { who, n, hint: tooLow ? 'up' : 'down' }],
        turn: who === 'p1' ? 'p2' : 'p1',
      }
    })
    setUpdownGuess('')
  }

  function resetUpdown() {
    setUpdown(newUpdownState())
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

  const activeState =
    activeGame === 'sum15' ? sum15 : activeGame === 'bingo' ? bingo : activeGame === 'stairs' ? stairs : updown
  const turnIndicatorText = activeState.winner
    ? activeState.winner === 'draw'
      ? '무승부!'
      : `${activeState.winner === 'p1' ? player1 : player2} 승리!`
    : `차례: ${activeState.turn === 'p1' ? player1 : player2}`

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
          {pushSupported() && currentMemberId && (
            <button
              type="button"
              onClick={togglePush}
              disabled={pushBusy}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-display font-bold border shrink-0 transition duration-150 active:scale-95 disabled:opacity-60 ${
                pushOn
                  ? 'bg-secondary-dark text-on-secondary border-foreground'
                  : 'bg-surface-muted text-foreground-muted border-border'
              }`}
              aria-pressed={pushOn}
            >
              <i className={`ph-bold ${pushOn ? 'ph-bell-ringing' : 'ph-bell-slash'} text-xs`} aria-hidden="true"></i>
              {pushBusy ? '...' : pushOn ? '알림 켜짐' : '휴대폰 알림'}
            </button>
          )}
        </div>
        {pushMsg && <p className="text-[12px] text-destructive mb-3 leading-[18px]">{pushMsg}</p>}
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
              {sessions.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {sessions.map((row) => (
                    <li key={row.session_id} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-foreground-muted min-w-0">
                        {memberName(row.p1_member_id)}의 {GAME_TABS.find((t) => t.key === row.game_key)?.label}
                        {row.p2_member_id ? ` · ${memberName(row.p2_member_id)} 참가함` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => (row.p2_member_id ? applySession(row) : joinRemote(row))}
                        disabled={remoteBusy}
                        className="text-[12px] font-display font-bold text-primary shrink-0 active:scale-95 transition duration-150 disabled:opacity-60"
                      >
                        {row.p2_member_id ? '보기' : '참가하기'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {remoteMsg && <p className="text-[12px] text-destructive mt-2 leading-[18px]">{remoteMsg}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <select
            value={player1Id}
            onChange={(e) => setPlayer1Id(e.target.value)}
            disabled={Boolean(session)}
            className="bg-surface-muted rounded-md px-2 py-2 text-[13px] border border-border outline-none"
          >
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                선수1 · {m.name}
              </option>
            ))}
          </select>
          <select
            value={player2Id}
            onChange={(e) => setPlayer2Id(e.target.value)}
            disabled={Boolean(session)}
            className="bg-surface-muted rounded-md px-2 py-2 text-[13px] border border-border outline-none"
          >
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                선수2 · {m.name}
              </option>
            ))}
          </select>
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

        <p className="text-[14px] font-display font-bold mb-3">
          {turnIndicatorText}
          {session && !myTurn && !session.winner && (
            <span className="ml-2 font-body font-normal text-[13px] text-foreground-muted">
              {session.p2_member_id ? '(상대 차례를 기다리는 중)' : '(상대를 기다리는 중)'}
            </span>
          )}
        </p>

        {activeGame === 'sum15' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">번갈아 숫자를 하나씩 가져가서, 내가 가진 숫자 3개의 합이 15가 되면 승리해요.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
                const owner = sum15.owners[n] || undefined
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSum15Pick(n)}
                    disabled={!!owner || !!sum15.winner || !myTurn}
                    data-owner={owner}
                    className="num-cell bg-surface-muted border border-border rounded-md py-3 font-display font-bold text-[18px] active:scale-95 transition duration-150"
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {sum15.winner ? (sum15.winner === 'draw' ? '무승부예요!' : `${sum15.winner === 'p1' ? player1 : player2} 승리!`) : ' '}
            </p>
            <button
              type="button"
              onClick={() => setSum15(newSum15State())}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'bingo' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">내 차례에 문제가 나오면, 내 판에서 정답 칸을 찾아 눌러요. 먼저 한 줄을 완성하면 승리해요.</p>
            <div className="bg-surface-muted rounded-md px-4 py-3 text-center mb-3">
              <p className="text-[13px] text-foreground-muted">
                {bingo.winner ? '문제' : `${bingo.turn === 'p1' ? player1 : player2}의 문제`}
              </p>
              <p className="font-display font-extrabold text-[28px]">{bingo.winner ? '-' : bingo.problem.text}</p>
              <p className="text-[12px] text-foreground-muted">정답은 내 판 위에 반드시 있어요</p>
            </div>

            {bingo.feedback && !bingo.winner && (
              <p
                className={`text-[13px] font-display font-bold text-center mb-3 ${
                  bingo.feedback.ok ? 'text-secondary' : 'text-destructive'
                }`}
              >
                {bingo.feedback.ok
                  ? `${bingo.feedback.value} 정답! 칸을 뚫었어요.`
                  : `${bingo.feedback.value}은(는) 아니에요. 정답은 ${bingo.feedback.answer}였어요.`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 mb-3">
              {['p1', 'p2'].map((key) => (
                <div key={key}>
                  <p className={`text-[12px] font-display font-bold text-center mb-1 ${key === bingo.turn && !bingo.winner ? 'text-primary' : 'text-foreground-muted'}`}>
                    {key === 'p1' ? player1 : player2}
                    {key === bingo.turn && !bingo.winner ? ' · 내 차례' : ''}
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
              onClick={() => setBingo(newBingoState())}
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
              <strong>1</strong>이 나오면 모아둔 걸 전부 잃어요. 한 턴에는 최대 {STAIRS_MAX_POT}칸까지만 모을 수 있고,
              누가 {STAIRS_TARGET}칸에 닿으면 상대도 마지막 한 턴을 받아요. 그 뒤 더 높이 오른 사람이 승리!
            </p>

            {stairs.chaseFor && !stairs.winner && (
              <p className="text-[13px] font-display font-bold text-accent text-center mb-3">
                마지막 기회! {stairs.chaseFor === 'p1' ? player1 : player2}이(가) 넘어야 해요.
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
                    ? '1이 나왔어요! 모아둔 걸 잃었어요'
                    : stairs.pot >= STAIRS_MAX_POT
                      ? `${STAIRS_MAX_POT}칸이 최대예요. 멈추기를 누르세요`
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
                disabled={!!stairs.winner || stairs.pot >= STAIRS_MAX_POT || !myTurn}
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
              onClick={() => setStairs(newStairsState())}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'updown' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">
              1부터 100 사이의 숨은 숫자를 번갈아 맞혀요. 틀리면 업/다운 힌트가 나오고 범위가 좁아져요. 먼저 정확히 맞히면 승리해요.
            </p>

            <div className="bg-surface-muted rounded-md px-4 py-3 text-center mb-3">
              <p className="text-[13px] text-foreground-muted">남은 범위</p>
              <p className="font-display font-extrabold text-[28px]">
                {updown.low} ~ {updown.high}
              </p>
            </div>

            <form onSubmit={handleUpdownGuess} className="flex items-center gap-2 mb-3">
              <input
                type="number"
                inputMode="numeric"
                value={updownGuess}
                onChange={(e) => setUpdownGuess(e.target.value)}
                min={updown.low}
                max={updown.high}
                disabled={!!updown.winner || !myTurn}
                placeholder={`${updown.low}~${updown.high} 사이의 숫자`}
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
              {updown.winner ? `${updown.winner === 'p1' ? player1 : player2} 승리! 정답은 ${updown.secret}이었어요.` : ' '}
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
