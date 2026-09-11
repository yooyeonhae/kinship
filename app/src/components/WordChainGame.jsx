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
  // Setup & Settings State
  const [inGame, setInGame] = useState(false)
  const [inWaitingRoom, setInWaitingRoom] = useState(false) // 대기실 상태
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'family_versus' | 'family_relay'
  const [botDiff, setBotDiff] = useState('normal') // 'easy' | 'normal' | 'boss'
  const [selectedMemberIds, setSelectedMemberIds] = useState(() =>
    members.filter((m) => m.member_id !== currentMemberId).map((m) => m.member_id)
  )
  const [turnDuration, setTurnDuration] = useState(15) // seconds, 0 = unlimited
  const [relayTarget, setRelayTarget] = useState(20) // target words for co-op
  const [strictDict, setStrictDict] = useState(true) // dictionary check
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)

  // In-Game Active State
  const [players, setPlayers] = useState([]) // [{ id, name, avatar, isBot }]
  const [activeTurnIdx, setActiveTurnIdx] = useState(0)
  const [alivePlayerIds, setAlivePlayerIds] = useState(new Set())
  const [words, setWords] = useState([]) // [{ who, byName, avatar, word }]
  const [currentHead, setCurrentHead] = useState('') // required head characters
  const [remainTime, setRemainTime] = useState(15)
  const [feedback, setFeedback] = useState(null) // { ok, message }
  const [botQuote, setBotQuote] = useState('')
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [countdown, setCountdown] = useState(null) // null | 3 | 2 | 1 | 'GO'
  const [gameOver, setGameOver] = useState(null) // { winner, winnerName, reason, totalWords }
  const [hintWord, setHintWord] = useState('')

  // Multiplayer Session & Invitation State
  const [sessionId, setSessionId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [hostInfo, setHostInfo] = useState(null)
  const [acceptedMembers, setAcceptedMembers] = useState({}) // { [memberId]: { id, name, avatar, status: 'accepted' } }
  const [invitedMembers, setInvitedMembers] = useState([])
  const [pendingInvite, setPendingInvite] = useState(null) // Received invitation for current user
  const [dismissedInviteIds, setDismissedInviteIds] = useState(new Set())
  const [inviteToast, setInviteToast] = useState(null)
  const [busyRemote, setBusyRemote] = useState(false)

  // Text / Keypad Input
  const [wordInput, setWordInput] = useState('')
  const [composer] = useState(() => new HangulComposer())
  const [kbShift, setKbShift] = useState(false)

  // Floating Reactions / Spectator Cheers
  const [reactions, setReactions] = useState([])

  // State synchronization refs
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

  // Sync state to refs
  useEffect(() => {
    activeTurnIdxRef.current = activeTurnIdx
  }, [activeTurnIdx])

  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    currentHeadRef.current = currentHead
  }, [currentHead])

  useEffect(() => {
    playersRef.current = players
  }, [players])

  useEffect(() => {
    alivePlayerIdsRef.current = alivePlayerIds
  }, [alivePlayerIds])

  useEffect(() => {
    gameOverRef.current = gameOver
  }, [gameOver])

  useEffect(() => {
    isBotThinkingRef.current = isBotThinking
  }, [isBotThinking])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

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

  // Scroll chain ribbon to end when words change
  useEffect(() => {
    if (chainScrollRef.current) {
      chainScrollRef.current.scrollLeft = chainScrollRef.current.scrollWidth
    }
  }, [words])

  // Current active player object
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

  // Check for active invites / sessions periodically
  const checkForInvites = useCallback(async () => {
    if (!supabase || !familyId || !currentMemberId || inGame || inWaitingRoom) return
    try {
      const res = await loadSessions(supabase)
      if (res.error || !res.data) return

      // Find an active wordchain session that invites current member
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

  // Apply full remote session state when received from Supabase / Broadcast
  const applyRemoteState = useCallback(
    (remoteState, newSessionId) => {
      if (!remoteState) return
      if (remoteState.version && remoteState.version <= lastStateVersionRef.current) {
        return
      }
      lastStateVersionRef.current = remoteState.version || Date.now()

      console.log('📡 [원격 상태 수신 및 동기화]', remoteState)

      if (newSessionId && sessionIdRef.current !== newSessionId) {
        setSessionId(newSessionId)
      }

      setGameMode(remoteState.gameMode || 'family_versus')
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

      // ── Status: WAITING (대기실) ──
      if (remoteState.status === 'waiting') {
        setInWaitingRoom(true)
        setInGame(false)
        setPendingInvite(null)
        return
      }

      // ── Status: PLAYING (실시간 게임 진행) ──
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

  // Listen to Supabase Realtime channel for live invites, acceptances and moves
  useEffect(() => {
    if (!channelRef?.current) return

    const channel = channelRef.current
    const onBroadcast = async ({ payload }) => {
      if (!payload) return

      // 1. Invitation broadcast
      if (payload.event === 'game:invite' || payload.type === 'invite') {
        if (payload.invitedMemberIds?.includes(currentMemberId) && payload.hostId !== currentMemberId && !inGame && !inWaitingRoom) {
          playCountdownSound(false, soundEnabled)
          checkForInvites()
        }
        return
      }

      // 2. Member acceptance broadcast (대기실 실시간 수락)
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

      // 3. Game start broadcast
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

  // Periodic poll to keep waiting room and game synchronized
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
  // 💌 Invitation & Lobby Waiting Room Handlers
  // ─────────────────────────────────────────────────────────────

  // Step 1: Host creates Waiting Room & sends Invitations
  async function createWaitingRoomAndInvite() {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    clearInterval(timerRef.current)

    const me = members.find((m) => m.member_id === currentMemberId) || members[0] || { name: '나', member_id: 'p1' }

    if (gameMode === 'bot') {
      // Single Player against Bot
      startBotGame()
      return
    }

    // Multiplayer Family Match: Create Session in WAITING status
    setBusyRemote(true)
    try {
      if (supabase) {
        await removeMyOpenSessions(supabase, currentMemberId)
      }

      const seed = randomSeedWord()
      const initialWords = [{ who: 'seed', byName: '시작 단어', avatar: '🌱', word: seed }]
      const initialHead = lastCharOf(seed)

      const initialAccepted = {
        [currentMemberId]: {
          id: currentMemberId,
          name: me.name,
          avatar: characterOf(me) || '👑',
          status: 'accepted',
          isHost: true,
        },
      }

      const sessionState = {
        gameKey: 'wordchain',
        gameMode,
        status: 'waiting', // Waiting for invitees to accept
        hostId: currentMemberId,
        hostName: me.name,
        hostAvatar: characterOf(me) || '👑',
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

      if (supabase && familyId) {
        const { data, error } = await createSession(supabase, {
          familyId,
          gameKey: 'wordchain',
          memberId: currentMemberId,
          state: sessionState,
        })

        if (data && !error) {
          setSessionId(data.session_id)
          sessionIdRef.current = data.session_id
          setIsHost(true)
          setHostInfo({ id: currentMemberId, name: me.name, avatar: characterOf(me) || '👑' })
          setAcceptedMembers(initialAccepted)
          setInvitedMembers(selectedMemberIds)
          setInWaitingRoom(true)
          setInGame(false)

          // Broadcast Invitation Event to all connected family members
          channelRef?.current?.send({
            type: 'broadcast',
            event: 'game:invite',
            payload: {
              sessionId: data.session_id,
              type: 'invite',
              hostId: currentMemberId,
              hostName: me.name,
              hostAvatar: characterOf(me) || '👑',
              gameMode,
              invitedMemberIds: selectedMemberIds,
            },
          })

          // Web Push Notification to mobile devices
          notifyFamily({
            familyId,
            senderName: me.name,
            excludeMemberId: currentMemberId,
          })

          const invitedNames = selectedMemberIds
            .map((id) => members.find((m) => m.member_id === id)?.name)
            .filter(Boolean)
            .join(', ')

          setInviteToast(`💌 ${invitedNames || '가족'}님께 초대장을 보냈어요! 수락 시 대기실에 입장합니다.`)
          setTimeout(() => setInviteToast(null), 5000)
        }
      }
    } catch (err) {
      console.error('대기실 생성 실패:', err)
    } finally {
      setBusyRemote(false)
    }
  }

  // Step 2: Invitee Accepts Invitation & joins Waiting Room
  async function acceptInvitation(invite = pendingInvite) {
    if (!invite || !supabase) return
    const me = members.find((m) => m.member_id === currentMemberId) || { name: '나', member_id: currentMemberId }

    setBusyRemote(true)
    try {
      const { data: currentSession } = await fetchSession(supabase, invite.sessionId)
      if (!currentSession || currentSession.state?.gameOver) {
        setFeedback({ ok: false, message: '이미 종료되었거나 취소된 게임방입니다.' })
        setPendingInvite(null)
        return
      }

      const st = currentSession.state
      const updatedAccepted = {
        ...(st.acceptedMembers || {}),
        [currentMemberId]: {
          id: currentMemberId,
          name: me.name,
          avatar: characterOf(me) || '😊',
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

      // Update Session in Supabase
      await pushState(supabase, invite.sessionId, {
        state: updatedState,
        turn: 'p1',
      })

      // Set local state
      setIsHost(false)
      setSessionId(invite.sessionId)
      sessionIdRef.current = invite.sessionId
      setHostInfo({ id: st.hostId, name: st.hostName, avatar: st.hostAvatar })
      setAcceptedMembers(updatedAccepted)
      setInvitedMembers(st.invitedMemberIds || [])
      setInWaitingRoom(true)
      setInGame(false)
      setPendingInvite(null)

      // Broadcast acceptance to Host & other members
      channelRef?.current?.send({
        type: 'broadcast',
        event: 'game:accepted',
        payload: {
          sessionId: invite.sessionId,
          memberId: currentMemberId,
          name: me.name,
          avatar: characterOf(me) || '😊',
        },
      })
    } catch (err) {
      console.error('초대 수락 실패:', err)
    } finally {
      setBusyRemote(false)
    }
  }

  // Step 3: Host launches Game with all Accepted Members
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

    // Broadcast Game Start to all accepted participants
    await broadcastAndSaveState(updatedState, 'game:start')

    // Local Countdown animation
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
    const me = members.find((m) => m.member_id === currentMemberId) || members[0] || { name: '나', member_id: 'p1' }
    const botParticipants = [
      { id: me.member_id, name: me.name || '플레이어', avatar: characterOf(me) || '👨‍💻', isBot: false },
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

  // Leave Waiting Room / Exit
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

    // In online match, only the active player or host resolves timeout
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
      // Survival mode: eliminate active player
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

    // Skip eliminated players in survival mode
    while (!currentAlive.has(currentPlayers[nextIdx].id) && loopCount < currentPlayers.length) {
      nextIdx = (nextIdx + 1) % currentPlayers.length
      loopCount++
    }

    activeTurnIdxRef.current = nextIdx
    setActiveTurnIdx(nextIdx)

    const nextPlayer = currentPlayers[nextIdx]

    // Broadcast turn update in online game
    if (gameMode !== 'bot' && sessionIdRef.current) {
      broadcastAndSaveState({
        gameMode,
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

    // Success!
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

    // Check Co-op Relay target
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
                  <span className="underline decoration-tape-yellow">
                    {pendingInvite.gameMode === 'family_relay' ? '🤝 온 가족 릴레이' : '⚔️ 가족 서바이벌'}
                  </span>
                  에 초대했어요!
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

      {/* ── ⏳ MULTIPLAYER WAITING ROOM (대기실) ── */}
      {inWaitingRoom && (
        <div className="bg-surface border-4 border-foreground rounded-2xl p-5 md:p-6 shadow-sticker flex flex-col gap-4 animate-pop">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-xs font-extrabold text-primary px-2.5 py-0.5 bg-primary/10 rounded-full">
                {gameMode === 'family_relay' ? '🤝 온 가족 릴레이' : '⚔️ 가족 서바이벌'}
              </span>
              <h3 className="text-xl md:text-2xl font-display font-black mt-1">
                🎮 가족 게임 대기실
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
                👥 초대 및 수락 현황 ({acceptedCount}명 수락 완료)
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
          </div>

          {/* Action Buttons for Host vs Invitee */}
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
            <div className="text-center py-2 bg-surface-muted rounded-xl border border-border">
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
                <span className="text-sm font-display">{m.label}</span>
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
                    <span className="text-sm font-display">{d.label}</span>
                    <span className="text-[10px] leading-tight opacity-80">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-surface-muted rounded-lg p-3.5 border border-border flex flex-col gap-3">
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

              {/* Family Member Grid with Live Online/Login Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      className={`flex items-center justify-between p-2.5 rounded-xl border-2 text-left transition-all ${
                        isMe
                          ? 'border-primary bg-primary/15 opacity-90 cursor-default'
                          : isSelected
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border bg-surface/60 text-foreground-muted opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl">{characterOf(m)}</span>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm truncate">
                            {m.name} {isMe && <span className="text-[11px] text-primary font-bold">(나 👑)</span>}
                          </p>
                          <p className="text-[11px] font-bold mt-0.5">
                            {isOnline ? (
                              <span className="text-secondary font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> 🟢 접속 중
                              </span>
                            ) : (
                              <span className="text-foreground-muted">⚪ 오프라인</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {!isMe && (
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
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

              <p className="text-[12px] text-primary bg-primary/10 px-3 py-2 rounded-md border border-primary/20 leading-relaxed">
                💡 <strong>실시간 초대 방식</strong>: 초대하기 버튼을 누르면 선택한 가족 멤버들의 휴대폰으로 초대 알림이
                발송되며, 상대방이 <strong>초대를 수락하면 대기실에 입장</strong>하여 함께 대전이 시작됩니다.
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

          {/* Start Game / Invite Button */}
          <button
            type="button"
            onClick={createWaitingRoomAndInvite}
            disabled={busyRemote}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-display font-extrabold text-lg border-2 border-foreground shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
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

            {/* Quick Audio & Keypad Toggles */}
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

          {/* Turn Players Strip / Carousel */}
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

          {/* Center Screen Display (대형 전광판) */}
          <div className="bg-foreground text-surface rounded-2xl p-5 text-center shadow-lg border-2 border-foreground relative overflow-hidden flex flex-col items-center justify-center gap-1.5 min-h-[140px]">
            <div className="text-xs text-tape-yellow font-extrabold tracking-wider uppercase">
              이 글자로 시작하는 낱말!
            </div>

            {/* Glowing Big Prompt Character */}
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

          {/* Word Chain History Ribbon (가로 스크롤 타일) */}
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
                    createWaitingRoomAndInvite()
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
