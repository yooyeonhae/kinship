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
  currentMemberId = '',
  onRecordWinner = () => {},
}) {
  // Setup & Settings State
  const [inGame, setInGame] = useState(false)
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'family_versus' | 'family_relay'
  const [playStyle, setPlayStyle] = useState('online') // 'online' (각자 기기로 초대) | 'local' (한 기기로 패스)
  const [botDiff, setBotDiff] = useState('normal') // 'easy' | 'normal' | 'boss'
  const [selectedMemberIds, setSelectedMemberIds] = useState(() =>
    members.map((m) => m.member_id)
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
  const [pendingInvite, setPendingInvite] = useState(null) // Active invitation for this member
  const [dismissedInviteIds, setDismissedInviteIds] = useState(new Set())
  const [inviteToast, setInviteToast] = useState(null)
  const [busyRemote, setBusyRemote] = useState(false)

  // Text / Keypad Input
  const [wordInput, setWordInput] = useState('')
  const [composer] = useState(() => new HangulComposer())
  const [kbShift, setKbShift] = useState(false)

  // Floating Reactions / Spectator Cheers
  const [reactions, setReactions] = useState([])

  // State synchronization refs to prevent stale closures
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

  // Sync state to refs on every update
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

  // Ensure selected members stay valid
  useEffect(() => {
    if (members.length > 0 && selectedMemberIds.length === 0) {
      setSelectedMemberIds(members.map((m) => m.member_id))
    }
  }, [members, selectedMemberIds])

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
    (gameMode === 'bot'
      ? activePlayer.id !== 'bot'
      : playStyle === 'local'
        ? true
        : activePlayer.id === currentMemberId || !currentMemberId)

  const isSpectator =
    gameMode !== 'bot' &&
    playStyle === 'online' &&
    currentMemberId &&
    !players.some((p) => p.id === currentMemberId)

  // ─────────────────────────────────────────────────────────────
  // 📡 Realtime Invitation & Session Synchronization
  // ─────────────────────────────────────────────────────────────

  // Check for active invites / sessions periodically and on broadcast
  const checkForInvites = useCallback(async () => {
    if (!supabase || !familyId || !currentMemberId || inGame) return
    try {
      const res = await loadSessions(supabase)
      if (res.error || !res.data) return

      // Find an active wordchain session that invites current member
      const activeWordChain = res.data.find((s) => {
        if (s.game_key !== 'wordchain') return false
        const st = s.state
        if (!st || st.status !== 'playing' || st.gameOver) return false
        // Exclude dismissed sessions
        if (dismissedInviteIds.has(s.session_id)) return false
        // Check if I am invited and not the host
        const isInvited = st.invitedMemberIds?.includes(currentMemberId) || s.p2_member_id === currentMemberId
        const isNotHost = st.hostId !== currentMemberId
        return isInvited && isNotHost
      })

      if (activeWordChain) {
        setPendingInvite({
          sessionId: activeWordChain.session_id,
          hostId: activeWordChain.state.hostId,
          hostName: activeWordChain.state.hostName || '가족',
          hostAvatar: activeWordChain.state.hostAvatar || '👑',
          gameMode: activeWordChain.state.gameMode || 'family_versus',
          players: activeWordChain.state.players || [],
          startWord: activeWordChain.state.words?.[0]?.word || '',
          turnDuration: activeWordChain.state.turnDuration || 15,
        })
      } else {
        setPendingInvite(null)
      }
    } catch {
      // ignore
    }
  }, [supabase, familyId, currentMemberId, inGame, dismissedInviteIds])

  useEffect(() => {
    checkForInvites()
    const interval = setInterval(checkForInvites, 3000)
    return () => clearInterval(interval)
  }, [checkForInvites])

  // Apply full remote session state when received
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
      setPlayStyle('online')
      if (remoteState.turnDuration !== undefined) setTurnDuration(remoteState.turnDuration)
      if (remoteState.relayTarget !== undefined) setRelayTarget(remoteState.relayTarget)
      if (remoteState.strictDict !== undefined) setStrictDict(remoteState.strictDict)

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

        // If a new word was submitted by another player, trigger sound and voice
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

      setInGame(true)
      setPendingInvite(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMemberId, soundEnabled, voiceEnabled]
  )

  // Listen to Supabase Realtime channel for live moves and invitations
  useEffect(() => {
    if (!channelRef?.current) return

    const channel = channelRef.current
    const onBroadcast = async ({ payload }) => {
      if (!payload) return

      // Invitation broadcast received
      if (payload.event === 'game:invite' || payload.type === 'invite') {
        if (payload.invitedMemberIds?.includes(currentMemberId) && payload.hostId !== currentMemberId && !inGame) {
          playCountdownSound(false, soundEnabled)
          checkForInvites()
        }
        return
      }

      // Live game state update
      if (payload.sessionId && (payload.sessionId === sessionIdRef.current || !inGame)) {
        if (payload.state) {
          applyRemoteState(payload.state, payload.sessionId)
        } else if (supabase) {
          const { data } = await fetchSession(supabase, payload.sessionId)
          if (data?.state) {
            applyRemoteState(data.state, data.session_id)
          }
        }
      }

      // Spectator reaction broadcast
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
    channel.on('broadcast', { event: 'game:reaction' }, onBroadcast)

    return () => {
      // cleanup is handled on unmount
    }
  }, [channelRef, currentMemberId, inGame, soundEnabled, supabase, checkForInvites, applyRemoteState])

  // Periodic poll to keep online live game 100% synchronized even under unstable network
  useEffect(() => {
    if (!supabase || !sessionId || !inGame || gameMode === 'bot') return

    const syncInterval = setInterval(async () => {
      try {
        const { data } = await fetchSession(supabase, sessionId)
        if (data?.state) {
          applyRemoteState(data.state, data.session_id)
        }
      } catch {
        // ignore
      }
    }, 2500)

    return () => clearInterval(syncInterval)
  }, [supabase, sessionId, inGame, gameMode, applyRemoteState])

  // Push updated state to Supabase & Realtime Broadcast
  const broadcastAndSaveState = useCallback(
    async (updatedState) => {
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
          event: GAME_EVENT,
          payload: { sessionId: activeSessionId, state: finalState },
        })
      } catch (err) {
        console.error('❌ [원격 판 저장/전송 실패]', err)
      }
    },
    [supabase, channelRef]
  )

  // ─────────────────────────────────────────────────────────────
  // 🎮 Game Loop & Logic
  // ─────────────────────────────────────────────────────────────

  // Timer Tick Handling
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
    if (playStyle === 'online' && !isMyTurn && !isHostRef.current) {
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
  }, [gameMode, playStyle, isMyTurn, soundEnabled, voiceEnabled])

  // Start a New Game (Host / Local)
  async function startGame() {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    clearInterval(timerRef.current)
    const seed = randomSeedWord()

    const me = members.find((m) => m.member_id === currentMemberId) || members[0] || { name: '나', member_id: 'p1' }
    let participants = []

    if (gameMode === 'bot') {
      participants = [
        { id: me.member_id, name: me.name || '플레이어', avatar: characterOf(me) || '👨‍💻', isBot: false },
        {
          id: 'bot',
          name: botDiff === 'easy' ? '아기 로봇' : botDiff === 'boss' ? '끝판왕 로봇' : '똘똘한 로봇',
          avatar: botDiff === 'easy' ? '🐣' : botDiff === 'boss' ? '👑' : '🦊',
          isBot: true,
        },
      ]
    } else {
      const selected = members.filter((m) => selectedMemberIds.includes(m.member_id))
      participants = (selected.length > 0 ? selected : members).map((m) => ({
        id: m.member_id,
        name: m.name,
        avatar: characterOf(m) || '😊',
        isBot: false,
      }))
      if (participants.length === 1) {
        participants.push({ id: 'guest', name: '게스트', avatar: '🌟', isBot: false })
      }
    }

    const initialWords = [{ who: 'seed', byName: '시작 단어', avatar: '🌱', word: seed }]
    const initialHead = lastCharOf(seed)
    const initialAlive = new Set(participants.map((p) => p.id))

    playersRef.current = participants
    alivePlayerIdsRef.current = initialAlive
    activeTurnIdxRef.current = 0
    wordsRef.current = initialWords
    currentHeadRef.current = initialHead
    gameOverRef.current = null
    isBotThinkingRef.current = false
    setIsHost(true)

    setPlayers(participants)
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
    setInGame(true)

    // Online Multiplayer Invitation Creation & Dispatch
    if (gameMode !== 'bot' && playStyle === 'online' && supabase && familyId) {
      setBusyRemote(true)
      try {
        await removeMyOpenSessions(supabase, currentMemberId)

        const sessionState = {
          gameKey: 'wordchain',
          gameMode,
          playStyle: 'online',
          hostId: currentMemberId,
          hostName: me.name,
          hostAvatar: characterOf(me) || '👑',
          invitedMemberIds: selectedMemberIds,
          players: participants,
          activeTurnIdx: 0,
          alivePlayerIds: Array.from(initialAlive),
          words: initialWords,
          currentHead: initialHead,
          turnDuration,
          relayTarget,
          strictDict,
          gameOver: null,
          status: 'playing',
          roundId: Date.now(),
          version: 1,
          updatedAt: new Date().toISOString(),
        }

        const { data, error } = await createSession(supabase, {
          familyId,
          gameKey: 'wordchain',
          memberId: currentMemberId,
          state: sessionState,
        })

        if (data && !error) {
          setSessionId(data.session_id)
          sessionIdRef.current = data.session_id

          // Send Realtime Broadcast
          channelRef?.current?.send({
            type: 'broadcast',
            event: 'game:invite',
            payload: {
              sessionId: data.session_id,
              type: 'invite',
              hostId: currentMemberId,
              hostName: me.name,
              gameMode,
              invitedMemberIds: selectedMemberIds,
            },
          })

          // Send Push Notification
          const invitedNames = participants
            .filter((p) => p.id !== currentMemberId)
            .map((p) => p.name)
            .join(', ')
          notifyFamily({
            familyId,
            senderName: me.name,
            excludeMemberId: currentMemberId,
          })

          setInviteToast(
            `💌 ${invitedNames || '가족'}님께 초대장을 보냈어요! 상대방 기기에서 초대 수락 시 함께 진행됩니다.`
          )
          setTimeout(() => setInviteToast(null), 6000)
        }
      } catch (err) {
        console.error('초대장 생성 실패:', err)
      } finally {
        setBusyRemote(false)
      }
    }

    // Countdown animation
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

  // Accept Online Invitation (Invitee flow)
  async function acceptInvitation(invite = pendingInvite) {
    if (!invite || !supabase) return
    setBusyRemote(true)
    try {
      const { data, error } = await joinSession(supabase, { session_id: invite.sessionId }, currentMemberId)
      if (error || !data) {
        setFeedback({ ok: false, message: '이미 종료되었거나 진행 중인 방입니다.' })
        setPendingInvite(null)
        return
      }

      setIsHost(false)
      setSessionId(data.session_id)
      sessionIdRef.current = data.session_id
      applyRemoteState(data.state, data.session_id)

      // Broadcast join event
      channelRef?.current?.send({
        type: 'broadcast',
        event: GAME_EVENT,
        payload: { sessionId: data.session_id, joined: currentMemberId },
      })
    } catch (err) {
      console.error('초대 수락 실패:', err)
    } finally {
      setBusyRemote(false)
    }
  }

  // Dismiss Invitation
  function dismissInvitation() {
    if (pendingInvite) {
      setDismissedInviteIds((prev) => new Set([...prev, pendingInvite.sessionId]))
      setPendingInvite(null)
    }
  }

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

    // In survival mode, skip eliminated players
    while (!currentAlive.has(currentPlayers[nextIdx].id) && loopCount < currentPlayers.length) {
      nextIdx = (nextIdx + 1) % currentPlayers.length
      loopCount++
    }

    activeTurnIdxRef.current = nextIdx
    setActiveTurnIdx(nextIdx)

    const nextPlayer = currentPlayers[nextIdx]
    console.log(`🔄 [턴 전환] ${currentPlayers[fromIdx]?.name} ➔ ${nextPlayer?.name}`)

    // If in online match, broadcast updated turn to all devices
    if (playStyle === 'online' && sessionIdRef.current) {
      broadcastAndSaveState({
        gameMode,
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
    const head = currentHeadRef.current

    botTimeoutRef.current = setTimeout(() => {
      if (gameOverRef.current) return

      const currentHeadChar = currentHeadRef.current
      const currentWords = wordsRef.current
      const usedSet = new Set(currentWords.map((w) => w.word))
      const chosenWord = getBotWord(currentHeadChar, botDiff, usedSet)

      setIsBotThinking(false)
      isBotThinkingRef.current = false

      if (!chosenWord) {
        // Bot surrenders / failed
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

      // Bot played word
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

    // In online match, only the active player can submit
    if (playStyle === 'online' && !isMyTurn) {
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

    if (playStyle === 'online' && !isMyTurn) return

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
      // Survival mode: eliminate active player
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

    if (playStyle === 'online' && sessionIdRef.current) {
      broadcastAndSaveState({
        gameMode,
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
      // Only host or winner records points to prevent duplicates
      if (isHost || playStyle === 'local') {
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
    const xPos = 20 + Math.random() * 60 // 20% ~ 80%
    setReactions((prev) => [...prev, { id, emoji, label, xPos }])

    // Broadcast reaction in online game
    if (playStyle === 'online' && channelRef?.current) {
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

  // Leave / Quit Game
  async function handleExitGame() {
    if (window.confirm('게임을 종료하고 로비로 돌아갈까요?')) {
      clearInterval(timerRef.current)
      if (sessionId && isHost && supabase) {
        await leaveSession(supabase, sessionId)
      }
      setSessionId(null)
      setInGame(false)
      setGameOver(null)
    }
  }

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

      {/* ── 💌 INCOMING INVITATION BANNER (상대방 화면에 즉시 노출) ── */}
      {pendingInvite && !inGame && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-primary p-4 rounded-xl text-white shadow-sticker border-2 border-foreground mb-1 animate-pop">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{pendingInvite.hostAvatar}</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-white/25 rounded-full text-[11px] font-extrabold">
                    💌 초대장 도착!
                  </span>
                </div>
                <p className="font-display font-extrabold text-[15px] mt-0.5">
                  <strong>{pendingInvite.hostName}</strong> 님이{' '}
                  <span className="underline decoration-tape-yellow">
                    {pendingInvite.gameMode === 'family_relay' ? '🤝 온 가족 릴레이' : '⚔️ 가족 서바이벌'}
                  </span>
                  에 초대했어요!
                </p>
                <p className="text-xs text-white/90 mt-0.5">
                  참가 가족: {pendingInvite.players?.map((p) => p.name).join(', ')} · 턴 제한{' '}
                  {pendingInvite.turnDuration}초
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => acceptInvitation(pendingInvite)}
                disabled={busyRemote}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-surface text-foreground font-display font-extrabold text-sm rounded-lg shadow-sticker border-2 border-foreground active:scale-95 transition disabled:opacity-50"
              >
                🎮 초대 수락 & 바로 입장
              </button>
              <button
                type="button"
                onClick={dismissInvitation}
                className="px-3 py-2.5 bg-black/25 text-white text-xs font-bold rounded-lg hover:bg-black/40 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP / LOBBY SCREEN */}
      {!inGame && (
        <div className="bg-surface border-2 border-border rounded-xl p-4 md:p-6 shadow-soft flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-display font-extrabold text-foreground flex items-center justify-center gap-2">
              <span>👑</span> 끝말잇기 챔피언십
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              인공지능 로봇 대결부터 온 가족 실시간 서바이벌까지! 139,000+ 표준 명사 사전 탑재
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
              {/* Play Style Toggle (각자 기기 vs 한 기기) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                  📡 대전 방식 선택
                </span>
                <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setPlayStyle('online')}
                    className={`px-3 py-1.5 rounded-md font-bold transition ${
                      playStyle === 'online'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    📡 각자 폰으로 대전 (초대장 발송)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayStyle('local')}
                    className={`px-3 py-1.5 rounded-md font-bold transition ${
                      playStyle === 'local'
                        ? 'bg-secondary text-on-secondary shadow-xs'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    📱 한 기기로 번갈아 하기
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                  👥 참가 가족 멤버 선택 ({selectedMemberIds.length}명 참여)
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedMemberIds(members.map((m) => m.member_id))}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  가족 전원 선택
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {members.map((m) => {
                  const isSelected = selectedMemberIds.includes(m.member_id)
                  return (
                    <button
                      key={m.member_id}
                      type="button"
                      onClick={() => toggleMemberSelection(m.member_id)}
                      className={`flex items-center gap-2 p-2 rounded-md border text-sm font-bold transition ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : 'border-border bg-surface/40 text-foreground-muted opacity-60'
                      }`}
                    >
                      <span className="text-lg">{characterOf(m)}</span>
                      <span className="truncate">{m.name}</span>
                      {isSelected && <span className="ml-auto text-xs text-primary font-bold">✓</span>}
                    </button>
                  )
                })}
              </div>

              {playStyle === 'online' && (
                <p className="text-[12px] text-primary bg-primary/10 px-3 py-2 rounded-md border border-primary/20">
                  💡 <strong>초대장 발송 안내</strong>: 시작 버튼을 누르면 선택한 가족 멤버의 화면과 휴대폰으로 실시간
                  초대장이 전송되어 각자의 폰에서 바로 함께 플레이할 수 있습니다.
                </p>
              )}

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

          {/* Start Game Button */}
          <button
            type="button"
            onClick={startGame}
            disabled={busyRemote}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-display font-extrabold text-lg border-2 border-foreground shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {gameMode === 'bot'
              ? '🚀 로봇 대결 시작하기'
              : playStyle === 'online'
                ? '💌 가족 초대하고 실시간 대전 시작'
                : '🚀 한 기기로 시작하기'}
          </button>
        </div>
      )}

      {/* IN-GAME ACTIVE SCREEN */}
      {inGame && (
        <div className="flex flex-col gap-3">
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
              {playStyle === 'online' && sessionId && (
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

      {/* COUNTDOWN OVERLAY */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center pointer-events-none animate-fadeIn">
          <div className="text-8xl font-black text-tape-yellow drop-shadow-2xl animate-pop">
            {countdown}
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
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
                onClick={startGame}
                className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-display font-bold text-sm border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition"
              >
                🔄 다시 하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameOver(null)
                  setInGame(false)
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
