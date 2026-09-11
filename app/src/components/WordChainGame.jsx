import { useState, useEffect, useRef, useCallback } from 'react'
import { characterOf } from '../lib/avatars'
import { checkWord, getReqCharDisplay, lastCharOf, randomSeedWord, HangulComposer } from '../lib/wordChain'
import { getBotWord, getHintWord, BOT_QUOTES } from '../lib/wordChainData'
import {
  playKeySound,
  playOkSound,
  playErrSound,
  playTickSound,
  playCountdownSound,
  playWinSound,
  playCheerSound,
  speakKorean,
} from '../lib/wordChainAudio'
import { notifyFamily } from '../lib/push'
import { sendChat, CHAT_EVENT } from '../lib/familyRoom'
import {
  GAME_EVENT,
  createSession,
  loadSessions,
  joinSession,
  pushState,
  fetchSession,
  leaveSession,
  removeMyOpenSessions,
} from '../lib/gameSession'

const BOT_DIFFICULTIES = [
  { key: 'easy', label: '🐣 아기 로봇', desc: '쉬운 단어 위주, 가끔 항복 (어린이용)', icon: 'ph-baby' },
  { key: 'normal', label: '🦊 똘똘한 로봇', desc: '일반적인 단어로 안정적인 방어', icon: 'ph-brain' },
  { key: 'boss', label: '👑 끝판왕 로봇', desc: '한방 단어 공격 & 지능형 필승 전략', icon: 'ph-crown' },
]

const GAME_MODES = [
  { key: 'bot', label: '🤖 로봇 대결', sub: '혼자서 즐기는 AI 대결' },
  { key: 'family_versus', label: '⚔️ 가족 서바이벌', sub: '차례대로 이어가며 끝까지 생존' },
  { key: 'family_relay', label: '🤝 온 가족 릴레이', sub: '가족 전원 협동 목표 단어 달성' },
]

const TIMER_OPTIONS = [
  { key: 10, label: '10초 (스피드)' },
  { key: 15, label: '15초 (보통)' },
  { key: 30, label: '30초 (여유)' },
  { key: 0, label: '무제한 (자유)' },
]

const KEY_ROWS = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['SHIFT', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'DEL'],
]
const SHIFT_MAP = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' }

export default function WordChainGame({
  supabase = null,
  familyId = null,
  channelRef = null,
  members = [],
  onlineIds = [],
  currentMemberId = '',
  onRecordWinner = () => {},
}) {
  const currentMember = members.find((m) => m.member_id === currentMemberId) || members[0] || { name: '나', member_id: currentMemberId }

  // Navigation / Phase State
  const [inGame, setInGame] = useState(false)
  const [inWaitingRoom, setInWaitingRoom] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Settings & Configuration
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'family_versus' | 'family_relay'
  const [botDiff, setBotDiff] = useState('normal') // 'easy' | 'normal' | 'boss'
  const [roomNameInput, setRoomNameInput] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState(() =>
    members.filter((m) => m.member_id !== currentMemberId).map((m) => m.member_id)
  )
  const [turnDuration, setTurnDuration] = useState(15)
  const [relayTarget, setRelayTarget] = useState(20)
  const [strictDict, setStrictDict] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)

  // Multiplayer Room Session State
  const [sessionId, setSessionId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [hostInfo, setHostInfo] = useState(null)
  const [roomTitle, setRoomTitle] = useState('')
  const [acceptedMembers, setAcceptedMembers] = useState({}) // { [memberId]: { id, name, avatar, status: 'accepted' } }
  const [invitedMembers, setInvitedMembers] = useState([])
  const [pendingInvite, setPendingInvite] = useState(null)
  const [dispatchLogs, setDispatchLogs] = useState([])
  const [dbWarning, setDbWarning] = useState(null)
  const [dismissedInviteIds, setDismissedInviteIds] = useState(new Set())
  const [inviteToast, setInviteToast] = useState(null)
  const [busyRemote, setBusyRemote] = useState(false)

  // Active Game State
  const [players, setPlayers] = useState([]) // [{ id, name, avatar, isBot }]
  const [activeTurnIdx, setActiveTurnIdx] = useState(0)
  const [alivePlayerIds, setAlivePlayerIds] = useState(new Set())
  const [words, setWords] = useState([]) // [{ who, byName, avatar, word }]
  const [currentHead, setCurrentHead] = useState('')
  const [remainTime, setRemainTime] = useState(15)
  const [feedback, setFeedback] = useState(null)
  const [botQuote, setBotQuote] = useState('')
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [gameOver, setGameOver] = useState(null)
  const [hintWord, setHintWord] = useState('')

  // Text & Keypad Input
  const [wordInput, setWordInput] = useState('')
  const [composer] = useState(() => new HangulComposer())
  const [kbShift, setKbShift] = useState(false)
  const [reactions, setReactions] = useState([])

  // State synchronization refs to avoid stale closures
  const activeTurnIdxRef = useRef(0)
  const wordsRef = useRef([])
  const currentHeadRef = useRef('')
  const playersRef = useRef([])
  const alivePlayerIdsRef = useRef(new Set())
  const gameOverRef = useRef(null)
  const isBotThinkingRef = useRef(false)
  const botTimeoutRef = useRef(null)
  const sessionIdRef = useRef(null)
  const isHostRef = useRef(false)
  const lastStateVersionRef = useRef(0)

  const chainScrollRef = useRef(null)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  // Synchronize state values to refs
  useEffect(() => { activeTurnIdxRef.current = activeTurnIdx }, [activeTurnIdx])
  useEffect(() => { wordsRef.current = words }, [words])
  useEffect(() => { currentHeadRef.current = currentHead }, [currentHead])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { alivePlayerIdsRef.current = alivePlayerIds }, [alivePlayerIds])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { isBotThinkingRef.current = isBotThinking }, [isBotThinking])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { isHostRef.current = isHost }, [isHost])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Auto select other members on first load
  useEffect(() => {
    if (members.length > 0 && selectedMemberIds.length === 0) {
      const others = members.filter((m) => m.member_id !== currentMemberId).map((m) => m.member_id)
      setSelectedMemberIds(others.length > 0 ? others : members.map((m) => m.member_id))
    }
  }, [members, currentMemberId, selectedMemberIds.length])

  // Auto-scroll ribbon on words change
  useEffect(() => {
    if (chainScrollRef.current) {
      chainScrollRef.current.scrollLeft = chainScrollRef.current.scrollWidth
    }
  }, [words])

  // Determine active turn status
  const activePlayer = players[activeTurnIdx] || null
  const isMyTurn =
    !gameOver &&
    activePlayer &&
    (gameMode === 'bot' ? activePlayer.id !== 'bot' : activePlayer.id === currentMemberId || !currentMemberId)

  const isSpectator =
    gameMode !== 'bot' &&
    currentMemberId &&
    !players.some((p) => p.id === currentMemberId)

  // ─────────────────────────────────────────────────────────────
  // 📡 Realtime Invitation & Session Synchronization
  // ─────────────────────────────────────────────────────────────

  // Check for active invites in Supabase periodically
  const checkForInvites = useCallback(async () => {
    if (!supabase || !familyId || !currentMemberId || inGame || inWaitingRoom) return
    try {
      const res = await loadSessions(supabase)
      if (res.error || !res.data) return

      const activeWordChain = res.data.find((s) => {
        if (s.game_key !== 'wordchain') return false
        const st = s.state
        if (!st || (st.status !== 'waiting' && st.status !== 'playing') || st.gameOver) return false
        if (dismissedInviteIds.has(s.session_id)) return false
        const isInvited = st.invitedMemberIds?.includes(currentMemberId) || s.p2_member_id === currentMemberId
        const isNotHost = st.hostId !== currentMemberId
        const hasNotAccepted = !st.acceptedMembers?.[currentMemberId]
        return isInvited && isNotHost && hasNotAccepted
      })

      if (activeWordChain) {
        setPendingInvite({
          sessionId: activeWordChain.session_id,
          roomName: activeWordChain.state.roomName || '가족 서바이벌',
          hostId: activeWordChain.state.hostId,
          hostName: activeWordChain.state.hostName || '가족',
          hostAvatar: activeWordChain.state.hostAvatar || '👑',
          gameMode: activeWordChain.state.gameMode || 'family_versus',
          invitedNames:
            activeWordChain.state.invitedMemberIds
              ?.map((id) => members.find((m) => m.member_id === id)?.name)
              .filter(Boolean)
              .join(', ') || '가족',
          turnDuration: activeWordChain.state.turnDuration || 15,
        })
      } else {
        setPendingInvite(null)
      }
    } catch {
      // ignore
    }
  }, [supabase, familyId, currentMemberId, inGame, inWaitingRoom, dismissedInviteIds, members])

  useEffect(() => {
    checkForInvites()
    const interval = setInterval(checkForInvites, 3000)
    return () => clearInterval(interval)
  }, [checkForInvites])

  // Apply remote session state to local component
  const applyRemoteState = useCallback(
    (remoteState, newSessionId) => {
      if (!remoteState) return
      if (remoteState.version && remoteState.version <= lastStateVersionRef.current) {
        return
      }
      lastStateVersionRef.current = remoteState.version || Date.now()

      if (newSessionId && sessionIdRef.current !== newSessionId) {
        setSessionId(newSessionId)
      }

      setGameMode(remoteState.gameMode || 'family_versus')
      if (remoteState.roomName) setRoomTitle(remoteState.roomName)
      if (remoteState.turnDuration !== undefined) setTurnDuration(remoteState.turnDuration)
      if (remoteState.relayTarget !== undefined) setRelayTarget(remoteState.relayTarget)
      if (remoteState.strictDict !== undefined) setStrictDict(remoteState.strictDict)

      if (remoteState.hostId) {
        setHostInfo({ id: remoteState.hostId, name: remoteState.hostName, avatar: remoteState.hostAvatar })
      }
      if (remoteState.acceptedMembers) {
        setAcceptedMembers(remoteState.acceptedMembers)
      }
      if (remoteState.invitedMemberIds) {
        setInvitedMembers(remoteState.invitedMemberIds)
      }

      // ── WAITING ROOM PHASE ──
      if (remoteState.status === 'waiting') {
        setInWaitingRoom(true)
        setInGame(false)
        setPendingInvite(null)
        return
      }

      // ── ACTIVE GAME PHASE ──
      if (remoteState.status === 'playing') {
        setInWaitingRoom(false)
        setInGame(true)
        setPendingInvite(null)

        if (remoteState.players) setPlayers(remoteState.players)
        if (remoteState.alivePlayerIds) {
          const nextAlive = new Set(remoteState.alivePlayerIds)
          setAlivePlayerIds(nextAlive)
          alivePlayerIdsRef.current = nextAlive
        }

        if (remoteState.words) {
          const prevCount = wordsRef.current.length
          const nextWords = remoteState.words
          setWords(nextWords)
          wordsRef.current = nextWords

          if (nextWords.length > prevCount && prevCount > 0) {
            const lastWordObj = nextWords[nextWords.length - 1]
            if (lastWordObj && lastWordObj.who !== currentMemberId) {
              playOkSound(soundEnabled)
              speakKorean(lastWordObj.word, { voiceEnabled })
              setFeedback({ ok: true, message: `👏 ${lastWordObj.byName}: [${lastWordObj.word}] 이어감!` })
            }
          }
        }

        if (remoteState.currentHead) {
          setCurrentHead(remoteState.currentHead)
          currentHeadRef.current = remoteState.currentHead
        }

        if (remoteState.activeTurnIdx !== undefined) {
          setActiveTurnIdx(remoteState.activeTurnIdx)
          activeTurnIdxRef.current = remoteState.activeTurnIdx
          setRemainTime(remoteState.turnDuration > 0 ? remoteState.turnDuration : 999)
          composer.reset()
          setWordInput('')
        }

        if (remoteState.gameOver) {
          finishGameLocally(remoteState.gameOver)
        } else {
          setGameOver(null)
          gameOverRef.current = null
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMemberId, soundEnabled, voiceEnabled]
  )

  // Listen to Supabase Realtime channel events
  useEffect(() => {
    if (!channelRef?.current) return
    const channel = channelRef.current

    const onBroadcast = async ({ payload }) => {
      if (!payload) return

      // 1. Invitation broadcast received
      if (payload.event === 'game:invite' || payload.type === 'invite') {
        if (payload.invitedMemberIds?.includes(currentMemberId) && payload.hostId !== currentMemberId && !inGame && !inWaitingRoom) {
          playCountdownSound(false, soundEnabled)
          checkForInvites()
        }
        return
      }

      // 2. Member acceptance event in Waiting Room
      if (payload.event === 'game:accepted' || payload.type === 'accepted') {
        if (payload.sessionId === sessionIdRef.current) {
          playOkSound(soundEnabled)
          setAcceptedMembers((prev) => ({
            ...prev,
            [payload.memberId]: {
              id: payload.memberId,
              name: payload.name,
              avatar: payload.avatar,
              status: 'accepted',
            },
          }))
        }
        return
      }

      // 3. Game start event from Host
      if (payload.event === 'game:start' || payload.type === 'start') {
        if (payload.sessionId === sessionIdRef.current && payload.state) {
          applyRemoteState(payload.state, payload.sessionId)
          setCountdown(3)
          playCountdownSound(false, soundEnabled)
          let count = 3
          const cdTimer = setInterval(() => {
            count -= 1
            if (count > 0) {
              setCountdown(count)
              playCountdownSound(false, soundEnabled)
            } else if (count === 0) {
              setCountdown('GO!')
              playCountdownSound(true, soundEnabled)
              speakKorean(payload.state.words?.[0]?.word || '', { voiceEnabled })
            } else {
              clearInterval(cdTimer)
              setCountdown(null)
            }
          }, 900)
        }
        return
      }

      // 4. Live turn update
      if (payload.sessionId && (payload.sessionId === sessionIdRef.current || inWaitingRoom)) {
        if (payload.state) {
          applyRemoteState(payload.state, payload.sessionId)
        } else if (supabase) {
          const { data } = await fetchSession(supabase, payload.sessionId)
          if (data?.state) {
            applyRemoteState(data.state, data.session_id)
          }
        }
      }

      // 5. Spectator cheer reaction
      if (payload.type === 'reaction' && payload.reaction) {
        const { emoji, label, xPos } = payload.reaction
        const id = Date.now() + Math.random()
        setReactions((prev) => [...prev, { id, emoji, label, xPos }])
        playCheerSound(soundEnabled)
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== id))
        }, 2400)
      }
    }

    channel.on('broadcast', { event: GAME_EVENT }, onBroadcast)
    channel.on('broadcast', { event: 'game:invite' }, onBroadcast)
    channel.on('broadcast', { event: 'game:accepted' }, onBroadcast)
    channel.on('broadcast', { event: 'game:start' }, onBroadcast)
    channel.on('broadcast', { event: 'game:reaction' }, onBroadcast)

    return () => {}
  }, [channelRef, currentMemberId, inGame, inWaitingRoom, soundEnabled, voiceEnabled, supabase, checkForInvites, applyRemoteState])

  // Polling sync to ensure resilience
  useEffect(() => {
    if (!supabase || !sessionId || gameMode === 'bot') return

    const syncInterval = setInterval(async () => {
      try {
        const { data } = await fetchSession(supabase, sessionId)
        if (data?.state) {
          applyRemoteState(data.state, data.session_id)
        }
      } catch {
        // ignore
      }
    }, 2000)

    return () => clearInterval(syncInterval)
  }, [supabase, sessionId, gameMode, applyRemoteState])

  // Push updated state to Supabase & Realtime Broadcast
  const broadcastAndSaveState = useCallback(
    async (updatedState, eventType = GAME_EVENT) => {
      const activeSessionId = sessionIdRef.current
      if (!supabase || !activeSessionId) return

      const version = (lastStateVersionRef.current || 0) + 1
      lastStateVersionRef.current = version
      const finalState = {
        ...updatedState,
        version,
        updatedAt: new Date().toISOString(),
      }

      try {
        await pushState(supabase, activeSessionId, {
          state: finalState,
          turn: 'p1',
          winner: finalState.gameOver?.winner || null,
        })

        channelRef?.current?.send({
          type: 'broadcast',
          event: eventType,
          payload: { sessionId: activeSessionId, state: finalState },
        })
      } catch (err) {
        console.error('❌ [원격 판 저장/전송 실패]', err)
      }
    },
    [supabase, channelRef]
  )

  // ─────────────────────────────────────────────────────────────
  // 💌 Invitation & Room Creation Handlers
  // ─────────────────────────────────────────────────────────────

  // Open Room Creation Modal
  function handleOpenCreateModal() {
    if (gameMode === 'bot') {
      startBotGame()
      return
    }
    const defaultName = `🔥 ${currentMember.name}의 ${gameMode === 'family_relay' ? '온 가족 릴레이' : '가족 서바이벌'}!`
    setRoomNameInput(defaultName)
    setShowCreateModal(true)
  }

  // Host confirms room name and sends final invites
  async function handleConfirmCreateRoom() {
    setShowCreateModal(false)
    setBusyRemote(true)
    setDbWarning(null)
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    clearInterval(timerRef.current)

    const logs = []
    const addLog = (step, status, detail = '') => {
      const item = { step, status, detail, time: new Date().toLocaleTimeString('ko-KR') }
      logs.push(item)
      setDispatchLogs([...logs])
    }

    try {
      if (supabase) {
        await removeMyOpenSessions(supabase, currentMemberId)
      }

      const seed = randomSeedWord()
      const initialWords = [{ who: 'seed', byName: '시작 단어', avatar: '🌱', word: seed }]
      const initialHead = lastCharOf(seed)
      const finalRoomName = roomNameInput.trim() || `🔥 ${currentMember.name}의 가족 대전!`

      const initialAccepted = {
        [currentMemberId]: {
          id: currentMemberId,
          name: currentMember.name,
          avatar: characterOf(currentMember) || '👑',
          status: 'accepted',
          isHost: true,
        },
      }

      const sessionState = {
        gameKey: 'wordchain',
        gameMode,
        roomName: finalRoomName,
        status: 'waiting',
        hostId: currentMemberId,
        hostName: currentMember.name,
        hostAvatar: characterOf(currentMember) || '👑',
        invitedMemberIds: selectedMemberIds,
        acceptedMembers: initialAccepted,
        players: [initialAccepted[currentMemberId]],
        words: initialWords,
        currentHead: initialHead,
        turnDuration,
        relayTarget,
        strictDict,
        gameOver: null,
        roundId: Date.now(),
        version: 1,
        updatedAt: new Date().toISOString(),
      }

      const invitedNames = selectedMemberIds
        .map((id) => members.find((m) => m.member_id === id)?.name)
        .filter(Boolean)
        .join(', ')

      let activeSessionId = null

      // ── STEP 1: Supabase game_sessions DB 세션 생성 ──
      if (supabase && familyId) {
        console.log('[WordChainGame] 🚀 [1/4] Supabase game_sessions 테이블에 세션 등록 시도...', sessionState)
        addLog('1. 대전 세션 DB 등록', 'pending', 'Supabase에 세션 저장 중...')
        const { data, error } = await createSession(supabase, {
          familyId,
          gameKey: 'wordchain',
          memberId: currentMemberId,
          state: sessionState,
        })

        if (error) {
          console.error('[WordChainGame] ❌ [1/4] 세션 생성 실패:', error)
          const isTableMissing = error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('game_sessions')
          const warnText = isTableMissing
            ? 'game_sessions 테이블이 Supabase에 없습니다. (SQL 마이그레이션 실행 필요)'
            : `DB 오류: ${error.message}`
          addLog('1. 대전 세션 DB 등록', 'error', warnText)
          setDbWarning(warnText)
          activeSessionId = `local_${Date.now()}`
        } else if (data) {
          activeSessionId = data.session_id
          console.log('[WordChainGame] ✅ [1/4] 세션 생성 성공! ID:', activeSessionId)
          addLog('1. 대전 세션 DB 등록', 'ok', `세션 생성 완료 (ID: ${activeSessionId.slice(0, 8)}...)`)
        }
      } else {
        activeSessionId = `local_${Date.now()}`
        addLog('1. 대전 세션 DB 등록', 'ok', '로컬 세션 준비 완료')
      }

      setSessionId(activeSessionId)
      sessionIdRef.current = activeSessionId
      setIsHost(true)
      setRoomTitle(finalRoomName)
      setHostInfo({ id: currentMemberId, name: currentMember.name, avatar: characterOf(currentMember) || '👑' })
      setAcceptedMembers(initialAccepted)
      setInvitedMembers(selectedMemberIds)
      setInWaitingRoom(true)
      setInGame(false)

      // ── STEP 2: 가족 단체 톡방(chat_messages)에 초대 메시지 발송 ──
      if (supabase && familyId) {
        console.log('[WordChainGame] 🚀 [2/4] 가족 단체 톡방에 초대 메시지 발송 시도...')
        addLog('2. 가족 톡방 초대 메시지', 'pending', '가족 톡방에 등록 중...')
        const inviteChatContent = `🎮 [끝말잇기 초대] '${finalRoomName}' 방으로 초대합니다! (초대 대상: ${invitedNames || '가족'})`
        const chatRes = await sendChat(supabase, {
          familyId,
          memberId: currentMemberId,
          senderName: currentMember.name,
          content: inviteChatContent,
        })
        if (chatRes.error) {
          console.warn('[WordChainGame] ⚠️ [2/4] 가족 톡 등록 실패:', chatRes.error)
          addLog('2. 가족 톡방 초대 메시지', 'warn', chatRes.error.message || '채팅 전송 실패')
        } else {
          console.log('[WordChainGame] ✅ [2/4] 가족 톡 등록 성공:', chatRes.data)
          addLog('2. 가족 톡방 초대 메시지', 'ok', '가족 톡방에 초대장 게시 완료')
          channelRef?.current?.send({
            type: 'broadcast',
            event: CHAT_EVENT,
            payload: chatRes.data,
          })
        }
      }

      // ── STEP 3: 실시간 가족 채널(Broadcast game:invite) 전송 ──
      console.log('[WordChainGame] 🚀 [3/4] 실시간 채널(game:invite) 브로드캐스트 발송...')
      addLog('3. 실시간 초대 브로드캐스트', 'pending', '가족 기기로 실시간 신호 전송 중...')
      let sendStatus = 'unknown'
      if (channelRef?.current) {
        try {
          sendStatus = await channelRef.current.send({
            type: 'broadcast',
            event: 'game:invite',
            payload: {
              sessionId: activeSessionId,
              type: 'invite',
              roomName: finalRoomName,
              hostId: currentMemberId,
              hostName: currentMember.name,
              hostAvatar: characterOf(currentMember) || '👑',
              gameMode,
              turnDuration,
              invitedMemberIds: selectedMemberIds,
            },
          })
        } catch (e) {
          sendStatus = 'error'
          console.error('[WordChainGame] ❌ [3/4] 브로드캐스트 에러:', e)
        }
      }
      console.log('[WordChainGame] ✅ [3/4] 브로드캐스트 결과:', sendStatus)
      addLog('3. 실시간 초대 브로드캐스트', sendStatus === 'ok' ? 'ok' : 'warn', `상태: ${sendStatus}`)

      // ── STEP 4: 모바일 웹 푸시 알림 요청 ──
      console.log('[WordChainGame] 🚀 [4/4] 모바일 웹 푸시 알림 요청...')
      addLog('4. 모바일 푸시 알림', 'pending', '푸시 알림 서버 요청 중...')
      notifyFamily({
        familyId,
        senderName: currentMember.name,
        excludeMemberId: currentMemberId,
      })
      console.log('[WordChainGame] ✅ [4/4] 모바일 웹 푸시 요청 완료')
      addLog('4. 모바일 푸시 알림', 'ok', '푸시 알림 발송 요청 완료')

      setInviteToast(`💌 '${finalRoomName}' 초대장을 ${invitedNames || '가족'}님께 보냈어요!`)
      setTimeout(() => setInviteToast(null), 6000)
    } catch (err) {
      console.error('방 생성 처리 중 예외 발생:', err)
      addLog('방 생성 프로세스', 'error', err.message || '오류 발생')
    } finally {
      setBusyRemote(false)
    }
  }

  // Invitee accepts invite and enters the created room
  async function acceptInvitation(invite = pendingInvite) {
    if (!invite) return
    setBusyRemote(true)
    console.log('[WordChainGame] 🤝 초대 수락 진행:', invite)
    try {
      let currentSession = null
      if (supabase && invite.sessionId && !invite.sessionId.startsWith('local_') && !invite.sessionId.startsWith('temp_')) {
        const { data } = await fetchSession(supabase, invite.sessionId)
        currentSession = data
      }

      if (currentSession?.state?.gameOver) {
        setFeedback({ ok: false, message: '이미 종료되었거나 취소된 게임방입니다.' })
        setPendingInvite(null)
        return
      }

      const st = currentSession?.state || {
        roomName: invite.roomName,
        hostId: invite.hostId,
        hostName: invite.hostName,
        hostAvatar: invite.hostAvatar,
        gameMode: invite.gameMode,
        turnDuration: invite.turnDuration,
        invitedMemberIds: [invite.hostId, currentMemberId],
      }

      const updatedAccepted = {
        ...(st.acceptedMembers || {}),
        [currentMemberId]: {
          id: currentMemberId,
          name: currentMember.name,
          avatar: characterOf(currentMember) || '😊',
          status: 'accepted',
          isHost: false,
        },
      }

      const updatedState = {
        ...st,
        acceptedMembers: updatedAccepted,
        version: (st.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      }

      if (supabase && currentSession) {
        await pushState(supabase, invite.sessionId, {
          state: updatedState,
          turn: 'p1',
        })
      }

      setIsHost(false)
      setSessionId(invite.sessionId)
      sessionIdRef.current = invite.sessionId
      setRoomTitle(st.roomName || '가족 서바이벌')
      setHostInfo({ id: st.hostId, name: st.hostName, avatar: st.hostAvatar })
      setAcceptedMembers(updatedAccepted)
      setInvitedMembers(st.invitedMemberIds || [])
      setInWaitingRoom(true)
      setInGame(false)
      setPendingInvite(null)

      // Broadcast acceptance
      console.log('[WordChainGame] 📡 수락 브로드캐스트 전송...')
      channelRef?.current?.send({
        type: 'broadcast',
        event: 'game:accepted',
        payload: {
          sessionId: invite.sessionId,
          memberId: currentMemberId,
          name: currentMember.name,
          avatar: characterOf(currentMember) || '😊',
        },
      })
    } catch (err) {
      console.error('초대 수락 실패:', err)
    } finally {
      setBusyRemote(false)
    }
  }

  // Host launches game with all accepted members
  async function startMultiplayerGame() {
    const acceptedList = Object.values(acceptedMembers).filter((m) => m.status === 'accepted')
    if (acceptedList.length === 0) return

    const seed = words[0]?.word || randomSeedWord()
    const initialWords = [{ who: 'seed', byName: '시작 단어', avatar: '🌱', word: seed }]
    const initialHead = lastCharOf(seed)
    const initialAlive = new Set(acceptedList.map((p) => p.id))

    playersRef.current = acceptedList
    alivePlayerIdsRef.current = initialAlive
    activeTurnIdxRef.current = 0
    wordsRef.current = initialWords
    currentHeadRef.current = initialHead
    gameOverRef.current = null
    isBotThinkingRef.current = false

    setPlayers(acceptedList)
    setAlivePlayerIds(initialAlive)
    setActiveTurnIdx(0)
    setWords(initialWords)
    setCurrentHead(initialHead)
    setRemainTime(turnDuration > 0 ? turnDuration : 999)
    setFeedback(null)
    setGameOver(null)
    setHintWord('')
    setWordInput('')
    composer.reset()
    setInWaitingRoom(false)
    setInGame(true)

    const updatedState = {
      gameKey: 'wordchain',
      gameMode,
      roomName: roomTitle,
      status: 'playing',
      hostId: currentMemberId,
      hostName: hostInfo?.name || '방장',
      hostAvatar: hostInfo?.avatar || '👑',
      players: acceptedList,
      activeTurnIdx: 0,
      alivePlayerIds: Array.from(initialAlive),
      words: initialWords,
      currentHead: initialHead,
      turnDuration,
      relayTarget,
      strictDict,
      gameOver: null,
      roundId: Date.now(),
      version: (lastStateVersionRef.current || 0) + 1,
      updatedAt: new Date().toISOString(),
    }

    await broadcastAndSaveState(updatedState, 'game:start')

    // Local Countdown
    setCountdown(3)
    playCountdownSound(false, soundEnabled)

    let count = 3
    const cdTimer = setInterval(() => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
        playCountdownSound(false, soundEnabled)
      } else if (count === 0) {
        setCountdown('GO!')
        playCountdownSound(true, soundEnabled)
        speakKorean(seed, { voiceEnabled })
      } else {
        clearInterval(cdTimer)
        setCountdown(null)
      }
    }, 900)
  }

  // Single Player Bot Game Start
  function startBotGame() {
    const botParticipants = [
      { id: currentMember.member_id, name: currentMember.name || '플레이어', avatar: characterOf(currentMember) || '👨‍💻', isBot: false },
      {
        id: 'bot',
        name: botDiff === 'easy' ? '아기 로봇' : botDiff === 'boss' ? '끝판왕 로봇' : '똘똘한 로봇',
        avatar: botDiff === 'easy' ? '🐣' : botDiff === 'boss' ? '👑' : '🦊',
        isBot: true,
      },
    ]

    const seed = randomSeedWord()
    const initialWords = [{ who: 'seed', byName: '시작 단어', avatar: '🌱', word: seed }]
    const initialHead = lastCharOf(seed)
    const initialAlive = new Set(botParticipants.map((p) => p.id))

    playersRef.current = botParticipants
    alivePlayerIdsRef.current = initialAlive
    activeTurnIdxRef.current = 0
    wordsRef.current = initialWords
    currentHeadRef.current = initialHead
    gameOverRef.current = null
    isBotThinkingRef.current = false

    setPlayers(botParticipants)
    setAlivePlayerIds(initialAlive)
    setActiveTurnIdx(0)
    setWords(initialWords)
    setCurrentHead(initialHead)
    setRemainTime(turnDuration > 0 ? turnDuration : 999)
    setFeedback(null)
    setGameOver(null)
    setHintWord('')
    setWordInput('')
    setIsBotThinking(false)
    composer.reset()
    setBotQuote(BOT_QUOTES.intro[Math.floor(Math.random() * BOT_QUOTES.intro.length)])
    setInWaitingRoom(false)
    setInGame(true)

    setCountdown(3)
    playCountdownSound(false, soundEnabled)
    let count = 3
    const cdTimer = setInterval(() => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
        playCountdownSound(false, soundEnabled)
      } else if (count === 0) {
        setCountdown('GO!')
        playCountdownSound(true, soundEnabled)
        speakKorean(seed, { voiceEnabled })
      } else {
        clearInterval(cdTimer)
        setCountdown(null)
      }
    }, 900)
  }

  // Dismiss Invitation
  function dismissInvitation() {
    if (pendingInvite) {
      setDismissedInviteIds((prev) => new Set([...prev, pendingInvite.sessionId]))
      setPendingInvite(null)
    }
  }

  // Leave Waiting Room
  async function handleLeaveWaitingRoom() {
    if (sessionId && isHost && supabase) {
      await leaveSession(supabase, sessionId)
    }
    setInWaitingRoom(false)
    setInGame(false)
    setSessionId(null)
    setAcceptedMembers({})
  }

  // ─────────────────────────────────────────────────────────────
  // 🎮 In-Game Turn Progression & Logic
  // ─────────────────────────────────────────────────────────────

  // Turn Timer Tick
  useEffect(() => {
    if (!inGame || countdown !== null || gameOver || turnDuration === 0) return

    if (activePlayer && activePlayer.id === 'bot') {
      return
    }

    timerRef.current = setInterval(() => {
      setRemainTime((prev) => {
        if (prev <= 0.1) {
          clearInterval(timerRef.current)
          handleTimeUp()
          return 0
        }
        const next = prev - 0.1
        if (next > 0 && Math.abs(next - Math.round(next)) < 0.06 && Math.round(next) <= 3) {
          if (isMyTurn) playTickSound(soundEnabled)
        }
        return next
      })
    }, 100)

    return () => clearInterval(timerRef.current)
  }, [inGame, countdown, gameOver, activeTurnIdx, activePlayer, turnDuration, soundEnabled, isMyTurn])

  // Handle Time Expired
  const handleTimeUp = useCallback(() => {
    if (gameOverRef.current) return
    const currentTurn = activeTurnIdxRef.current
    const currPl = playersRef.current[currentTurn]
    if (!currPl) return

    if (gameMode !== 'bot' && !isMyTurn && !isHostRef.current) {
      return
    }

    playErrSound(soundEnabled)

    if (gameMode === 'bot') {
      const res = {
        winner: 'bot',
        winnerName: '끝판왕 로봇',
        reason: '시간 초과로 로봇이 승리했습니다!',
        totalWords: wordsRef.current.length - 1,
      }
      finishGame(res)
      speakKorean('시간 초과! 로봇의 승리입니다.', { voiceEnabled })
    } else if (gameMode === 'family_relay') {
      const res = {
        winner: null,
        winnerName: '릴레이 종료',
        reason: `${currPl.name} 님의 시간 초과로 릴레이가 멈췄어요!`,
        totalWords: wordsRef.current.length - 1,
      }
      finishGame(res)
    } else {
      const nextAlive = new Set(alivePlayerIdsRef.current)
      nextAlive.delete(currPl.id)
      alivePlayerIdsRef.current = nextAlive
      setAlivePlayerIds(nextAlive)

      if (nextAlive.size <= 1) {
        const survivorId = Array.from(nextAlive)[0]
        const survivor = playersRef.current.find((p) => p.id === survivorId) || currPl
        const res = {
          winner: survivor.id,
          winnerName: survivor.name,
          reason: `시간 초과로 ${currPl.name} 님 탈락! 최후의 승자는 ${survivor.name} 님!`,
          totalWords: wordsRef.current.length - 1,
        }
        finishGame(res)
      } else {
        setFeedback({ ok: false, message: `⏰ 시간 초과! ${currPl.name} 님 탈락!` })
        advanceTurn(currentTurn, nextAlive)
      }
    }
  }, [gameMode, isMyTurn, soundEnabled, voiceEnabled])

  // Turn Advancement
  function advanceTurn(fromIdx = activeTurnIdxRef.current, currentAlive = alivePlayerIdsRef.current) {
    if (gameOverRef.current) return
    composer.reset()
    setWordInput('')
    setHintWord('')
    setRemainTime(turnDuration > 0 ? turnDuration : 999)

    const currentPlayers = playersRef.current
    if (!currentPlayers || currentPlayers.length === 0) return

    let nextIdx = (fromIdx + 1) % currentPlayers.length
    let loopCount = 0

    while (!currentAlive.has(currentPlayers[nextIdx].id) && loopCount < currentPlayers.length) {
      nextIdx = (nextIdx + 1) % currentPlayers.length
      loopCount++
    }

    activeTurnIdxRef.current = nextIdx
    setActiveTurnIdx(nextIdx)

    const nextPlayer = currentPlayers[nextIdx]

    if (gameMode !== 'bot' && sessionIdRef.current) {
      broadcastAndSaveState({
        gameMode,
        roomName: roomTitle,
        status: 'playing',
        players: currentPlayers,
        alivePlayerIds: Array.from(currentAlive),
        words: wordsRef.current,
        currentHead: currentHeadRef.current,
        activeTurnIdx: nextIdx,
        turnDuration,
        relayTarget,
        strictDict,
        gameOver: null,
      })
    }

    if (nextPlayer && nextPlayer.id === 'bot') {
      runBotTurn(nextIdx)
    } else {
      setIsBotThinking(false)
      isBotThinkingRef.current = false
      if (nextPlayer.id === currentMemberId) {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
  }

  // Bot Turn Logic
  function runBotTurn(botIdx = activeTurnIdxRef.current) {
    if (gameOverRef.current) return
    setIsBotThinking(true)
    isBotThinkingRef.current = true

    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    const delay = 900 + Math.random() * 800

    botTimeoutRef.current = setTimeout(() => {
      if (gameOverRef.current) return

      const currentHeadChar = currentHeadRef.current
      const currentWords = wordsRef.current
      const usedSet = new Set(currentWords.map((w) => w.word))
      const chosenWord = getBotWord(currentHeadChar, botDiff, usedSet)

      setIsBotThinking(false)
      isBotThinkingRef.current = false

      if (!chosenWord) {
        playWinSound(soundEnabled)
        const quote = BOT_QUOTES.defeat[Math.floor(Math.random() * BOT_QUOTES.defeat.length)]
        setBotQuote(quote)
        speakKorean(quote, { voiceEnabled })

        finishGame({
          winner: playersRef.current[0].id,
          winnerName: playersRef.current[0].name,
          reason: `로봇이 더 이상 이을 단어를 찾지 못했습니다! 🏆`,
          totalWords: currentWords.length,
        })
        return
      }

      playOkSound(soundEnabled)
      speakKorean(chosenWord, { voiceEnabled })

      const isAttack = chosenWord.endsWith('륨') || chosenWord.endsWith('늄') || chosenWord.endsWith('슘') || chosenWord.endsWith('듐') || chosenWord.endsWith('쁨')
      const quoteList = isAttack ? BOT_QUOTES.attack : BOT_QUOTES.defend
      const quote = quoteList[Math.floor(Math.random() * quoteList.length)]
      setBotQuote(quote)

      const newHead = lastCharOf(chosenWord)
      currentHeadRef.current = newHead
      setCurrentHead(newHead)

      const botPlayer = playersRef.current[botIdx] || { name: '로봇', avatar: '🤖' }
      const newWords = [
        ...currentWords,
        { who: 'bot', byName: botPlayer.name, avatar: botPlayer.avatar, word: chosenWord },
      ]
      wordsRef.current = newWords
      setWords(newWords)

      setFeedback({ ok: true, message: `로봇: [${chosenWord}] 제출 완료!` })
      advanceTurn(botIdx, alivePlayerIdsRef.current)
    }, delay)
  }

  // Word Submit Handler
  function submitWord(rawText) {
    const currentTurn = activeTurnIdxRef.current
    const activePl = playersRef.current[currentTurn]
    if (gameOverRef.current || countdown !== null || isBotThinkingRef.current || !activePl) return

    if (gameMode !== 'bot' && !isMyTurn) {
      setFeedback({ ok: false, message: `⏳ 지금은 ${activePl.name} 님의 차례입니다.` })
      return
    }

    const trimmed = (rawText || wordInput || composer.text).trim()
    if (!trimmed) {
      setFeedback({ ok: false, message: '단어를 입력해 주세요.' })
      playErrSound(soundEnabled)
      return
    }

    const currentWords = wordsRef.current
    const usedWords = currentWords.map((w) => w.word)
    const currentHeadChar = currentHeadRef.current
    const result = checkWord(trimmed, {
      lastChar: currentHeadChar,
      used: usedWords,
      dictionaryOnly: strictDict,
    })

    if (!result.ok) {
      playErrSound(soundEnabled)
      let msg = '끝말잇기 규칙에 맞지 않아요.'
      if (result.reason === 'head') {
        msg = `'${getReqCharDisplay(currentHeadChar)}'(으)로 시작해야 해요.`
      } else if (result.reason === 'used') {
        msg = `'${trimmed}'은(는) 이미 나온 단어예요!`
      } else if (result.reason === 'short') {
        msg = '두 글자 이상의 낱말을 입력해 주세요.'
      } else if (result.reason === 'dict') {
        msg = `'${trimmed}'은(는) 사전에 없는 낱말이에요. (다른 단어를 시도하거나 '힌트'를 눌러보세요!)`
      } else if (result.reason === 'hangul') {
        msg = '올바른 한글 단어를 입력해 주세요.'
      }
      setFeedback({ ok: false, message: msg })
      return
    }

    playOkSound(soundEnabled)
    speakKorean(result.word, { voiceEnabled })

    const newHead = lastCharOf(result.word)
    currentHeadRef.current = newHead
    setCurrentHead(newHead)

    const newWords = [
      ...currentWords,
      { who: activePl.id, byName: activePl.name, avatar: activePl.avatar, word: result.word },
    ]
    wordsRef.current = newWords
    setWords(newWords)

    setFeedback({ ok: true, message: `🎉 ${activePl.name}: [${result.word}] 정답!` })
    setWordInput('')
    composer.reset()

    if (gameMode === 'family_relay' && newWords.length - 1 >= relayTarget) {
      playWinSound(soundEnabled)
      const res = {
        winner: 'team',
        winnerName: '온 가족 원팀',
        reason: `대단해요! 온 가족이 힘을 합쳐 목표 ${relayTarget}단어를 모두 이었어요! 🎉`,
        totalWords: newWords.length - 1,
      }
      finishGame(res)
      return
    }

    advanceTurn(currentTurn, alivePlayerIdsRef.current)
  }

  // Player Surrender / Give up
  function handleSurrender() {
    if (gameOverRef.current) return
    const currentTurn = activeTurnIdxRef.current
    const activePl = playersRef.current[currentTurn]
    if (!activePl) return

    if (gameMode !== 'bot' && !isMyTurn) return
    playErrSound(soundEnabled)

    if (gameMode === 'bot') {
      const res = {
        winner: 'bot',
        winnerName: '끝판왕 로봇',
        reason: `${activePl.name} 님이 모르겠어요를 눌렀습니다. 로봇 승리!`,
        totalWords: wordsRef.current.length - 1,
      }
      finishGame(res)
    } else if (gameMode === 'family_relay') {
      const res = {
        winner: null,
        winnerName: '릴레이 종료',
        reason: `${activePl.name} 님이 포기하여 릴레이가 끝났습니다.`,
        totalWords: wordsRef.current.length - 1,
      }
      finishGame(res)
    } else {
      const nextAlive = new Set(alivePlayerIdsRef.current)
      nextAlive.delete(activePl.id)
      alivePlayerIdsRef.current = nextAlive
      setAlivePlayerIds(nextAlive)

      if (nextAlive.size <= 1) {
        const survivorId = Array.from(nextAlive)[0]
        const survivor = playersRef.current.find((p) => p.id === survivorId) || activePl
        const res = {
          winner: survivor.id,
          winnerName: survivor.name,
          reason: `${activePl.name} 님 탈락! 최후의 승자는 ${survivor.name} 님!`,
          totalWords: wordsRef.current.length - 1,
        }
        finishGame(res)
      } else {
        setFeedback({ ok: false, message: `🏳️ ${activePl.name} 님 탈락!` })
        advanceTurn(currentTurn, nextAlive)
      }
    }
  }

  // Finish Game Locally
  function finishGameLocally(result) {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    clearInterval(timerRef.current)
    gameOverRef.current = result
    setGameOver(result)
    setIsBotThinking(false)
    isBotThinkingRef.current = false
    playWinSound(soundEnabled)
  }

  // Finish Game & Record Score
  function finishGame(result) {
    finishGameLocally(result)

    if (gameMode !== 'bot' && sessionIdRef.current) {
      broadcastAndSaveState({
        gameMode,
        roomName: roomTitle,
        status: 'playing',
        players: playersRef.current,
        alivePlayerIds: Array.from(alivePlayerIdsRef.current),
        words: wordsRef.current,
        currentHead: currentHeadRef.current,
        activeTurnIdx: activeTurnIdxRef.current,
        turnDuration,
        relayTarget,
        strictDict,
        gameOver: result,
      })
    }

    if (result.winner && result.winner !== 'bot') {
      if (isHost || gameMode === 'bot') {
        onRecordWinner(result.winner, result.totalWords)
      }
    }
  }

  // Request Hint
  function showHint() {
    const usedSet = new Set(words.map((w) => w.word))
    const hint = getHintWord(currentHead, usedSet)
    if (hint) {
      setHintWord(hint)
      setFeedback({ ok: true, message: `💡 힌트: '${hint}' (이 외에도 많아요!)` })
    } else {
      setFeedback({ ok: false, message: '💡 추천할 수 있는 단어가 없어요!' })
    }
  }

  // Spectator / Cheering Reaction
  function sendReaction(emoji, label) {
    playCheerSound(soundEnabled)
    const id = Date.now() + Math.random()
    const xPos = 20 + Math.random() * 60
    setReactions((prev) => [...prev, { id, emoji, label, xPos }])

    if (gameMode !== 'bot' && channelRef?.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game:reaction',
        payload: { reaction: { emoji, label, xPos } },
      })
    }

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id))
    }, 2400)
  }

  // Touch Keypad Typing
  function handleKeypadPress(k) {
    playKeySound(soundEnabled)
    if (k === 'SHIFT') {
      setKbShift(!kbShift)
    } else if (k === 'DEL') {
      composer.backspace()
      setWordInput(composer.text)
    } else {
      const char = kbShift && SHIFT_MAP[k] ? SHIFT_MAP[k] : k
      composer.input(char)
      setWordInput(composer.text)
      if (kbShift) setKbShift(false)
    }
  }

  // Member toggle for multiplayer
  function toggleMemberSelection(id) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    )
  }

  // Exit Active Game
  async function handleExitGame() {
    if (window.confirm('게임을 종료하고 로비로 돌아갈까요?')) {
      clearInterval(timerRef.current)
      if (sessionId && isHost && supabase) {
        await leaveSession(supabase, sessionId)
      }
      setSessionId(null)
      setInGame(false)
      setInWaitingRoom(false)
      setGameOver(null)
    }
  }

  const acceptedCount = Object.values(acceptedMembers).filter((m) => m.status === 'accepted').length

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col gap-3 font-body">
      {/* Floating Reaction Animation Elements */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.xPos}%` }}
            className="absolute bottom-24 text-3xl animate-bounce-up select-none flex flex-col items-center"
          >
            <span>{r.emoji}</span>
            {r.label && (
              <span className="text-[11px] font-bold bg-foreground text-surface px-2 py-0.5 rounded-full mt-1">
                {r.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Floating Toast Notification */}
      {inviteToast && (
        <div className="bg-foreground text-surface px-4 py-2.5 rounded-xl shadow-sticker text-sm font-bold flex items-center justify-between gap-2 animate-pop border-2 border-tape-yellow">
          <span>{inviteToast}</span>
          <button
            type="button"
            onClick={() => setInviteToast(null)}
            className="text-xs text-tape-yellow font-extrabold px-1.5 py-0.5 rounded hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 💌 INCOMING INVITATION BANNER (초대받은 사람에게 즉시 표시) ── */}
      {pendingInvite && !inGame && !inWaitingRoom && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-primary p-4 sm:p-5 rounded-2xl text-white shadow-sticker border-4 border-foreground mb-1 animate-pop">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{pendingInvite.hostAvatar}</span>
              <div>
                <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-extrabold">
                  💌 게임 초대장 도착!
                </span>
                <h4 className="text-base sm:text-lg font-display font-black mt-1">
                  <strong>{pendingInvite.hostName}</strong> 님이{' '}
                  <span className="underline decoration-tape-yellow">'{pendingInvite.roomName}'</span>에 초대했어요!
                </h4>
                <p className="text-xs text-white/90 mt-0.5">
                  참가 가족: {pendingInvite.invitedNames} · 턴 제한 {pendingInvite.turnDuration}초
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => acceptInvitation(pendingInvite)}
                disabled={busyRemote}
                className="flex-1 sm:flex-none px-5 py-3 bg-surface text-foreground font-display font-black text-sm rounded-xl border-2 border-foreground shadow-sticker active:scale-95 transition disabled:opacity-50"
              >
                ✅ 초대 수락 & 방 입장
              </button>
              <button
                type="button"
                onClick={dismissInvitation}
                className="px-3.5 py-3 bg-black/25 text-white font-bold text-xs rounded-xl hover:bg-black/40 transition"
              >
                거절
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 🏠 ROOM CREATION MODAL (방 제목 입력 및 초대 발송) ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-foreground/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border-4 border-foreground rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-sticker flex flex-col gap-4 animate-pop">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-display font-black text-foreground flex items-center gap-2">
                <span>🏠</span> 대전 방 만들기 & 초대장 발송
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-foreground-muted hover:text-foreground font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                🏷️ 방 제목 (초대 메시지에 표시됩니다)
              </label>
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="예: 우리 가족 끝말잇기 한판!"
                maxLength={40}
                className="bg-surface-muted border-2 border-border focus:border-primary rounded-xl px-4 py-3 text-base font-bold outline-none transition"
                autoFocus
              />
            </div>

            <div className="bg-surface-muted p-3 rounded-xl border border-border flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-foreground-muted">📨 초대받을 가족 멤버:</span>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {selectedMemberIds.map((id) => {
                  const m = members.find((x) => x.member_id === id)
                  if (!m) return null
                  const isOnline = onlineIds.includes(id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1 rounded-full text-xs font-bold shadow-xs"
                    >
                      <span>{characterOf(m)}</span>
                      <span>{m.name}</span>
                      {isOnline && <span className="w-2 h-2 rounded-full bg-secondary" />}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleConfirmCreateRoom}
                disabled={busyRemote || !roomNameInput.trim()}
                className="flex-1 py-3.5 bg-primary text-on-primary font-display font-extrabold text-sm rounded-xl border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition disabled:opacity-50"
              >
                🚀 방 생성 & 초대장 발송
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-3.5 bg-surface-muted text-foreground font-bold text-sm rounded-xl border border-border hover:bg-surface transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ⏳ MULTIPLAYER WAITING ROOM (대기실) ── */}
      {inWaitingRoom && (
        <div className="bg-surface border-4 border-foreground rounded-2xl p-5 md:p-6 shadow-sticker flex flex-col gap-4 animate-pop">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-xs font-extrabold text-primary px-2.5 py-0.5 bg-primary/10 rounded-full">
                {gameMode === 'family_relay' ? '🤝 온 가족 릴레이' : '⚔️ 가족 서바이벌'}
              </span>
              <h3 className="text-xl md:text-2xl font-display font-black mt-1 flex items-center gap-2">
                <span>🏠</span> {roomTitle || '가족 대전 대기실'}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleLeaveWaitingRoom}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-surface-muted hover:bg-destructive/10 text-destructive border border-border transition"
            >
              ✕ 나가기
            </button>
          </div>

          <div className="bg-surface-muted rounded-xl p-4 border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                👥 초대 및 수락 현황 ({acceptedCount}명 입장 완료)
              </span>
              <span className="text-xs font-bold text-secondary flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                실시간 수락 대기 중
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Host Card */}
              {hostInfo && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border-2 border-primary shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{hostInfo.avatar}</span>
                    <div>
                      <span className="font-display font-extrabold text-sm">{hostInfo.name}</span>
                      <span className="text-[11px] font-bold text-primary ml-1.5">(방장 👑)</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-extrabold rounded-md bg-primary text-on-primary">
                    준비 완료
                  </span>
                </div>
              )}

              {/* Invited Members Status */}
              {invitedMembers
                .filter((id) => id !== hostInfo?.id)
                .map((id) => {
                  const m = members.find((x) => x.member_id === id) || { name: '가족', member_id: id }
                  const accepted = acceptedMembers[id]?.status === 'accepted'
                  const isOnline = onlineIds.includes(id)
                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                        accepted
                          ? 'bg-secondary/10 border-secondary shadow-xs'
                          : 'bg-surface/60 border-border/70 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{characterOf(m)}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-sm">{m.name}</span>
                            {isOnline ? (
                              <span className="text-[10px] text-secondary font-bold">🟢 접속 중</span>
                            ) : (
                              <span className="text-[10px] text-foreground-muted">⚪ 오프라인</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {accepted ? (
                        <span className="px-2.5 py-1 text-xs font-extrabold rounded-md bg-secondary text-on-secondary animate-pop">
                          ✅ 수락 완료
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold rounded-md bg-surface-muted text-foreground-muted animate-pulse">
                          ⏳ 초대 중...
                        </span>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Realtime Dispatch Logs */}
            {dispatchLogs.length > 0 && (
              <div className="mt-2 p-3.5 rounded-xl bg-surface border border-border text-xs flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between font-bold text-foreground-muted pb-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5 text-foreground font-display">
                    <span>📡</span> 초대장 전송 상태 로그
                  </span>
                  <span className="text-[11px] font-normal text-foreground-muted">실시간 확인</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {dispatchLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {log.status === 'ok' && <span className="text-secondary font-black shrink-0">✅</span>}
                        {log.status === 'error' && <span className="text-destructive font-black shrink-0">❌</span>}
                        {log.status === 'warn' && <span className="text-tape-yellow font-black shrink-0">⚠️</span>}
                        {log.status === 'pending' && <span className="text-primary font-black shrink-0 animate-spin">⏳</span>}
                        <span className="font-semibold text-foreground truncate">{log.step}</span>
                      </span>
                      <span
                        className={`text-[11px] shrink-0 ${
                          log.status === 'error'
                            ? 'text-destructive font-bold'
                            : log.status === 'warn'
                              ? 'text-tape-yellow font-bold'
                              : 'text-foreground-muted'
                        }`}
                      >
                        {log.detail || (log.status === 'ok' ? '성공' : '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DB Warning Alert */}
            {dbWarning && (
              <div className="mt-2 p-3 bg-destructive/10 border-2 border-destructive/40 rounded-xl text-xs text-destructive flex flex-col gap-1">
                <p className="font-bold flex items-center gap-1">
                  <span>⚠️</span> {dbWarning}
                </p>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Supabase SQL Editor에서 <code>migration_16_game_sessions.sql</code>(또는 최신 <code>full_schema.sql</code>)을 실행하시면 대전 판이 영구 보존됩니다. (현재는 실시간 웹소켓 채널로 정상 대전이 가능합니다.)
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isHost ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={startMultiplayerGame}
                disabled={acceptedCount < 1}
                className="w-full py-4 rounded-xl bg-primary text-on-primary font-display font-black text-lg border-2 border-foreground shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
              >
                🚀 수락한 가족과 게임 시작하기 ({acceptedCount}명 참여)
              </button>
              {acceptedCount < 2 && (
                <p className="text-xs text-foreground-muted text-center">
                  💡 다른 가족이 초대장을 수락하면 여기에 바로 표시됩니다. (혼자 연습할 수도 있어요!)
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-3 bg-surface-muted rounded-xl border border-border">
              <p className="font-display font-extrabold text-sm text-foreground">
                방장(<strong>{hostInfo?.name}</strong>)님이 게임을 시작하기를 기다리고 있어요... ⏳
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                방장이 시작 버튼을 누르면 곧바로 카운트다운이 시작됩니다!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 🚀 SETUP / LOBBY SCREEN ── */}
      {!inGame && !inWaitingRoom && (
        <div className="bg-surface border-2 border-border rounded-xl p-4 md:p-6 shadow-soft flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-display font-extrabold text-foreground flex items-center justify-center gap-2">
              <span>👑</span> 끝말잇기 챔피언십
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              인공지능 로봇 대결부터 실시간 온 가족 서바이벌까지! 139,000+ 표준 명사 사전 탑재
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {GAME_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setGameMode(m.key)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all ${
                  gameMode === m.key
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border bg-surface-muted text-foreground-muted hover:border-foreground/30'
                }`}
              >
                <span className="text-sm font-display font-extrabold">{m.label}</span>
                <span className="text-[11px] opacity-75 mt-0.5 hidden sm:inline">{m.sub}</span>
              </button>
            ))}
          </div>

          {/* Mode-Specific Settings */}
          {gameMode === 'bot' ? (
            <div className="bg-surface-muted rounded-lg p-3.5 border border-border flex flex-col gap-2">
              <label className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                🤖 로봇 난이도 선택
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BOT_DIFFICULTIES.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setBotDiff(d.key)}
                    className={`p-2.5 rounded-md border text-left flex flex-col gap-1 transition ${
                      botDiff === d.key
                        ? 'border-foreground bg-surface shadow-sm font-bold'
                        : 'border-border bg-surface/50 text-foreground-muted'
                    }`}
                  >
                    <span className="text-sm font-display font-bold">{d.label}</span>
                    <span className="text-[10px] leading-tight opacity-80">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-surface-muted rounded-xl p-3.5 sm:p-4 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                  👥 초대할 가족 멤버 선택 (접속 상태 확인)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMemberIds(members.filter((m) => m.member_id !== currentMemberId).map((m) => m.member_id))
                  }
                  className="text-xs text-primary font-bold hover:underline"
                >
                  가족 전원 선택
                </button>
              </div>

              {/* Family Member Grid - Horizontal Layout to Prevent Text Wrapping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {members.map((m) => {
                  const isMe = m.member_id === currentMemberId
                  const isOnline = onlineIds.includes(m.member_id)
                  const isSelected = isMe || selectedMemberIds.includes(m.member_id)

                  return (
                    <button
                      key={m.member_id}
                      type="button"
                      disabled={isMe}
                      onClick={() => toggleMemberSelection(m.member_id)}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                        isMe
                          ? 'border-primary bg-primary/15 opacity-90 cursor-default'
                          : isSelected
                            ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                            : 'border-border bg-surface/60 text-foreground-muted opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{characterOf(m)}</span>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm truncate">
                            {m.name} {isMe && <span className="text-xs text-primary font-bold">(나 👑)</span>}
                          </p>
                          <p className="text-xs font-bold mt-0.5 whitespace-nowrap">
                            {isOnline ? (
                              <span className="text-secondary font-extrabold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> 🟢 접속 중
                              </span>
                            ) : (
                              <span className="text-foreground-muted">⚪ 오프라인</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {!isMe && (
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                            isSelected ? 'bg-primary text-on-primary border-primary' : 'border-border bg-surface'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-[12px] text-primary bg-primary/10 px-3 py-2 rounded-lg border border-primary/20 leading-relaxed">
                💡 <strong>실시간 초대 방식</strong>: 방 만들기 버튼을 누르면 방 제목을 정하고 가족들에게 초대장을 발송합니다.
                상대방이 <strong>수락하면 대기실에 자동 입장</strong>하여 함께 대전이 시작됩니다.
              </p>

              {gameMode === 'family_relay' && (
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                  <span className="font-bold text-foreground-muted">🎯 협동 목표 단어 수:</span>
                  <div className="flex gap-2">
                    {[10, 20, 30].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRelayTarget(t)}
                        className={`px-3 py-1 rounded-md text-xs font-bold border transition ${
                          relayTarget === t
                            ? 'bg-secondary text-on-secondary border-foreground'
                            : 'bg-surface border-border text-foreground-muted'
                        }`}
                      >
                        {t}개
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Game Rules & Settings Options */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface-muted/60 p-3 rounded-lg border border-border text-xs">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground-muted">⏱️ 턴 제한 시간</span>
              <select
                value={turnDuration}
                onChange={(e) => setTurnDuration(Number(e.target.value))}
                className="bg-surface border border-border rounded px-2 py-1 font-bold outline-none"
              >
                {TIMER_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground-muted">📖 단어 사전 판정</span>
              <button
                type="button"
                onClick={() => setStrictDict(!strictDict)}
                className={`border rounded px-2 py-1 font-bold transition text-center ${
                  strictDict ? 'bg-primary/15 text-primary border-primary' : 'bg-surface text-foreground-muted border-border'
                }`}
              >
                {strictDict ? '표준사전 엄격' : '가족 자유 허용'}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground-muted">🔊 게임 효과음</span>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`border rounded px-2 py-1 font-bold transition text-center ${
                  soundEnabled ? 'bg-secondary/15 text-secondary border-secondary' : 'bg-surface text-foreground-muted border-border'
                }`}
              >
                {soundEnabled ? '🔊 효과음 켜짐' : '🔇 음소거'}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground-muted">🗣️ 한국어 음성</span>
              <button
                type="button"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`border rounded px-2 py-1 font-bold transition text-center ${
                  voiceEnabled ? 'bg-tape-yellow/20 text-foreground border-foreground' : 'bg-surface text-foreground-muted border-border'
                }`}
              >
                {voiceEnabled ? '🗣️ 음성 켜짐' : '🤐 음성 끄기'}
              </button>
            </div>
          </div>

          {/* Start Game / Create Room Button */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            disabled={busyRemote}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-display font-black text-lg border-2 border-foreground shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {gameMode === 'bot' ? '🚀 로봇 대결 시작하기' : '💌 가족 초대하기 & 방 만들기'}
          </button>
        </div>
      )}

      {/* ── 🎮 IN-GAME ACTIVE SCREEN ── */}
      {inGame && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          {/* Header Controls & Spectator Banner */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-3.5 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitGame}
                className="px-2.5 py-1 text-xs font-bold rounded-md bg-surface-muted hover:bg-destructive/10 text-destructive border border-border transition"
              >
                ✕ 나가기
              </button>
              {isSpectator && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-pastel-mint text-foreground border border-border animate-pulse">
                  👀 관전 중
                </span>
              )}
              {gameMode !== 'bot' && sessionId && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  실시간 대전 중
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className={`p-1.5 text-xs font-bold rounded-md border transition ${
                  showKeypad ? 'bg-primary text-on-primary border-primary' : 'bg-surface-muted text-foreground-muted border-border'
                }`}
                title="가상 한글 키패드 토글"
              >
                ⌨️ 키패드
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 text-xs rounded-md bg-surface-muted text-foreground border border-border"
                title="사운드 토글"
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
            </div>
          </div>

          {/* Turn Players Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {players.map((p, idx) => {
              const isTurn = idx === activeTurnIdx && !gameOver
              const isAlive = alivePlayerIds.has(p.id)
              const isMe = p.id === currentMemberId
              return (
                <div
                  key={p.id}
                  className={`flex-1 min-w-[95px] flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 ${
                    !isAlive
                      ? 'border-border bg-surface-muted/50 opacity-40 grayscale'
                      : isTurn
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40 scale-[1.02]'
                        : 'border-border bg-surface'
                  }`}
                >
                  <span className="text-2xl">{p.avatar}</span>
                  <span className="text-xs font-bold font-display truncate max-w-[80px] mt-0.5">
                    {p.name} {isMe && <span className="text-primary">(나)</span>}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full mt-1 ${
                      isTurn ? 'bg-primary text-on-primary' : isAlive ? 'bg-surface-muted text-foreground-muted' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {isTurn ? '🔥 턴 진행' : isAlive ? '대기' : '탈락'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Robot Speech Bubble */}
          {gameMode === 'bot' && botQuote && (
            <div className="bg-surface border-2 border-foreground rounded-2xl px-4 py-2 text-center shadow-soft relative animate-pop">
              <span className="text-xs font-bold text-primary mr-1.5">🤖 로봇:</span>
              <span className="text-sm font-extrabold text-foreground">{botQuote}</span>
            </div>
          )}

          {/* Center Screen Display */}
          <div className="bg-foreground text-surface rounded-2xl p-5 text-center shadow-lg border-2 border-foreground relative overflow-hidden flex flex-col items-center justify-center gap-1.5 min-h-[140px]">
            <div className="text-xs text-tape-yellow font-extrabold tracking-wider uppercase">
              이 글자로 시작하는 낱말!
            </div>

            <div className="text-4xl sm:text-5xl font-display font-black text-tape-yellow tracking-tight animate-pulse drop-shadow-md">
              {getReqCharDisplay(currentHead)}
            </div>

            {words.length > 0 && (
              <div className="text-xs text-surface/70 mt-1">
                이전 단어: <strong className="text-surface font-bold">[{words[words.length - 1].word}]</strong> · 총{' '}
                <span className="text-tape-yellow font-bold">{words.length - 1}</span>단어 이음
              </div>
            )}
          </div>

          {/* Turn Timer Progress Bar */}
          {turnDuration > 0 && (
            <div className="w-full bg-surface-muted h-3.5 rounded-full overflow-hidden border border-border relative">
              <div
                style={{ width: `${Math.max(0, (remainTime / turnDuration) * 100)}%` }}
                className={`h-full transition-all duration-100 rounded-full ${
                  remainTime <= 3.5 ? 'bg-destructive animate-pulse' : 'bg-secondary'
                }`}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
                {Math.ceil(remainTime)}초
              </span>
            </div>
          )}

          {/* Word Chain History Ribbon */}
          <div
            ref={chainScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 bg-surface-muted/60 rounded-xl border border-border min-h-[46px]"
          >
            {words.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 shrink-0">
                {idx > 0 && <span className="text-foreground-muted text-xs font-bold">→</span>}
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-display font-bold shadow-sm ${
                    item.who === 'seed'
                      ? 'bg-tape-yellow/30 border-tape-yellow text-foreground'
                      : item.who === 'bot'
                        ? 'bg-destructive/10 border-destructive/30 text-destructive'
                        : 'bg-surface border-border text-foreground'
                  }`}
                >
                  <span>{item.avatar}</span>
                  <span className="font-extrabold">{item.word}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Feedback & Hint Message */}
          {feedback && (
            <div
              className={`text-center text-xs font-bold py-1.5 px-2 rounded-md ${
                feedback.ok ? 'text-secondary bg-secondary/10' : 'text-destructive bg-destructive/10'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Word Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitWord(wordInput)
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                disabled={!isMyTurn || isBotThinking || countdown !== null}
                placeholder={
                  isBotThinking
                    ? '🤖 로봇이 단어를 고르는 중입니다...'
                    : !isMyTurn
                      ? `⏳ ${activePlayer?.name || '상대방'} 님이 생각 중입니다...`
                      : `'${getReqCharDisplay(currentHead)}'로 시작하는 단어 입력`
                }
                className="flex-1 bg-surface border-2 border-border focus:border-primary rounded-xl px-4 py-3 text-base font-bold outline-none transition disabled:opacity-50"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!isMyTurn || isBotThinking || countdown !== null || !wordInput.trim()}
                className="px-5 py-3 rounded-xl bg-primary text-on-primary border-2 border-foreground shadow-sticker font-display font-bold text-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
              >
                말하기 ✓
              </button>
            </div>

            {/* Quick Action Helpers: Hint & Surrender */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={showHint}
                disabled={!isMyTurn || isBotThinking}
                className="text-xs text-foreground-muted hover:text-foreground font-bold px-3 py-1.5 rounded-lg bg-surface border border-border transition disabled:opacity-50 flex items-center gap-1"
              >
                💡 힌트 보기
              </button>

              <button
                type="button"
                onClick={handleSurrender}
                disabled={!isMyTurn || isBotThinking}
                className="text-xs text-destructive hover:bg-destructive/10 font-bold px-3 py-1.5 rounded-lg bg-surface border border-border transition disabled:opacity-50"
              >
                🏳️ 모르겠어요 (항복)
              </button>
            </div>
          </form>

          {/* Virtual Hangul Touch Keypad */}
          {showKeypad && isMyTurn && (
            <div className="bg-surface-muted p-2 rounded-xl border border-border flex flex-col gap-1.5 select-none animate-fadeIn">
              {KEY_ROWS.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-1 justify-center">
                  {row.map((k) => {
                    const isUtil = k === 'SHIFT' || k === 'DEL'
                    const label =
                      k === 'SHIFT'
                        ? kbShift
                          ? '⇧ 확정'
                          : '⇧ 쉬프트'
                        : k === 'DEL'
                          ? '⌫ 지움'
                          : kbShift && SHIFT_MAP[k]
                            ? SHIFT_MAP[k]
                            : k
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleKeypadPress(k)}
                        className={`flex-1 min-w-0 h-10 rounded-lg text-sm font-extrabold flex items-center justify-center border transition active:scale-95 ${
                          k === 'SHIFT' && kbShift
                            ? 'bg-tape-yellow text-foreground border-foreground'
                            : isUtil
                              ? 'bg-surface text-foreground-muted border-border'
                              : 'bg-surface text-foreground border-border shadow-xs'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Spectator Cheering & Reaction Floating Bar */}
          <div className="bg-surface border border-border rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground-muted">🎉 실시간 응원 리액션:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => sendReaction('👏', '짝짝짝!')}
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface border border-border rounded-lg text-sm font-bold active:scale-90 transition"
              >
                👏 박수
              </button>
              <button
                type="button"
                onClick={() => sendReaction('💖', '힘내요!')}
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface border border-border rounded-lg text-sm font-bold active:scale-90 transition"
              >
                💖 하트
              </button>
              <button
                type="button"
                onClick={() => sendReaction('🎉', '와아아!')}
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface border border-border rounded-lg text-sm font-bold active:scale-90 transition"
              >
                🎉 축하
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ⏱️ COUNTDOWN OVERLAY ── */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center pointer-events-none animate-fadeIn">
          <div className="text-8xl font-black text-tape-yellow drop-shadow-2xl animate-pop">
            {countdown}
          </div>
        </div>
      )}

      {/* ── 🏆 GAME OVER MODAL ── */}
      {gameOver && (
        <div className="fixed inset-0 bg-foreground/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border-4 border-foreground rounded-2xl p-6 max-w-sm w-full text-center shadow-sticker flex flex-col items-center gap-3 animate-pop">
            <span className="text-6xl animate-bounce">🏆</span>
            <h3 className="text-2xl font-display font-black text-foreground">
              {gameOver.winner === 'bot' ? '💀 로봇의 승리!' : '🎉 게임 종료!'}
            </h3>
            <p className="text-sm font-extrabold text-primary">
              {gameOver.winnerName}
            </p>
            <p className="text-xs text-foreground-muted leading-relaxed">
              {gameOver.reason}
            </p>
            <div className="bg-surface-muted px-4 py-2 rounded-lg border border-border text-xs font-bold text-foreground">
              이어간 단어 총 <span className="text-primary font-extrabold text-base">{gameOver.totalWords}</span>개!
            </div>

            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  setGameOver(null)
                  setInGame(false)
                  setInWaitingRoom(false)
                  if (gameMode === 'bot') {
                    startBotGame()
                  } else {
                    handleOpenCreateModal()
                  }
                }}
                className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-display font-bold text-sm border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition"
              >
                🔄 다시 하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameOver(null)
                  setInGame(false)
                  setInWaitingRoom(false)
                  setSessionId(null)
                }}
                className="px-4 py-3 bg-surface-muted text-foreground rounded-xl font-display font-bold text-sm border border-border hover:bg-surface transition"
              >
                로비로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
