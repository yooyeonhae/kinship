import React, { useState, useEffect, useRef } from 'react'
import {
  WORLD_LANDMARKS,
  getLandmarkById,
  getRandomLandmark,
  shuffleTiles,
  calcProgress,
} from '../lib/worldPuzzleData'

function playChime(type = 'swap') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (type === 'swap') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, ctx.currentTime)
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } else if (type === 'match') {
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'triangle'
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      gain1.gain.setValueAtTime(0.08, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start()
      osc1.stop(ctx.currentTime + 0.12)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08) // A5
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.08)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(ctx.currentTime + 0.08)
      osc2.stop(ctx.currentTime + 0.22)
    } else if (type === 'win') {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const startTime = ctx.currentTime + idx * 0.1
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.1, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + 0.3)
      })
    }
  } catch (e) {
    // 오디오 컨텍스트 제한 환경 안전 무시
  }
}

export default function WorldPuzzleGame({
  state,
  onStateChange,
  player1 = '선수1',
  player2 = '선수2',
  myTurn = true,
  onNewGame,
  session = null,
  currentMemberId = null,
  onInviteFamily = null,
}) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // 번호 힌트 1회 제한 및 카운트다운 타이머 (6초간 표시)
  const [hintActive, setHintActive] = useState(false)
  const [hintSecondsLeft, setHintSecondsLeft] = useState(0)

  const isRemote = Boolean(session)
  const myRole = session?.p1_member_id === currentMemberId ? 'p1' : session?.p2_member_id === currentMemberId ? 'p2' : 'p1'
  const oppRole = myRole === 'p1' ? 'p2' : 'p1'
  const oppName = oppRole === 'p1' ? player1 : player2
  const oppJoined = Boolean(session?.p2_member_id)

  const landmark = getLandmarkById(state?.destinationId)
  const gridSize = state?.gridSize || 3

  // 원격 세션일 경우 각자 독립된 타일과 이동 횟수 사용
  const p1Data = state?.p1 || { tiles: state?.tiles || [], moves: state?.moves || 0, completed: Boolean(state?.winner), time: 0, hintUsed: Boolean(state?.hintUsed) }
  const p2Data = state?.p2 || { tiles: state?.initialTiles || state?.tiles || [], moves: 0, completed: false, time: 0, hintUsed: false }

  const activeTiles = isRemote
    ? (myRole === 'p2' ? (p2Data.tiles || state?.tiles || []) : (p1Data.tiles || state?.tiles || []))
    : (state?.tiles || [])
  const activeMoves = isRemote
    ? (myRole === 'p2' ? (p2Data.moves || 0) : (p1Data.moves || 0))
    : (state?.moves || 0)
  const progress = calcProgress(activeTiles)
  const isComplete = progress.isComplete

  const oppData = oppRole === 'p1' ? p1Data : p2Data

  const mode = isRemote ? 'battle' : (state?.mode || 'solo') // 'solo' | 'battle'
  const battleStage = state?.battleStage || 'p1' // 'p1' | 'p2_ready' | 'p2' | 'result'

  // 경과 시간 타이머
  useEffect(() => {
    if (state?.winner || isComplete || (!isRemote && (battleStage === 'p2_ready' || battleStage === 'result'))) return
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [state?.winner, isComplete, battleStage, state?.roundId, isRemote])

  // 새 라운드 시작 시 리셋
  useEffect(() => {
    setElapsedSeconds(0)
    setSelectedIdx(null)
    setHintActive(false)
    setHintSecondsLeft(0)
  }, [state?.roundId, battleStage])

  // 번호 힌트 카운트다운 (6초)
  useEffect(() => {
    if (!hintActive) return
    if (hintSecondsLeft <= 0) {
      setHintActive(false)
      return
    }
    const t = setTimeout(() => {
      setHintSecondsLeft((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [hintActive, hintSecondsLeft])

  // 번호 힌트 사용 처리 (판당 1회)
  const handleUseNumberHint = () => {
    const isHintUsed = isRemote ? (myRole === 'p2' ? p2Data.hintUsed : p1Data.hintUsed) : state?.hintUsed
    if (isHintUsed || hintActive || isComplete || state?.winner) return
    setHintActive(true)
    setHintSecondsLeft(6)
    if (isRemote) {
      const myNewData = {
        ...(myRole === 'p1' ? p1Data : p2Data),
        hintUsed: true,
      }
      onStateChange({
        ...state,
        p1: myRole === 'p1' ? myNewData : p1Data,
        p2: myRole === 'p2' ? myNewData : p2Data,
      })
    } else {
      onStateChange({
        ...state,
        hintUsed: true,
      })
    }
  }

  // 모드 전환 (로컬 모드일 때만 허용)
  const handleSwitchMode = (newMode) => {
    if (mode === newMode || isRemote) return
    const newTiles = shuffleTiles(3)
    setSelectedIdx(null)
    setElapsedSeconds(0)
    setHintActive(false)
    onStateChange({
      ...state,
      mode: newMode,
      tiles: [...newTiles],
      initialTiles: [...newTiles],
      p1: { tiles: [...newTiles], moves: 0, completed: false, time: 0, hintUsed: false },
      p2: { tiles: [...newTiles], moves: 0, completed: false, time: 0, hintUsed: false },
      moves: 0,
      winner: null,
      battleStage: 'p1',
      p1Result: null,
      p2Result: null,
      hintUsed: false,
    })
  }

  // 퍼즐 조각 클릭 인터랙션
  const handleTileClick = (clickedIdx) => {
    if (state?.winner || isComplete) return
    if (!isRemote && (!myTurn || battleStage === 'p2_ready')) return

    if (selectedIdx === null) {
      setSelectedIdx(clickedIdx)
      playChime('swap')
      return
    }

    if (selectedIdx === clickedIdx) {
      setSelectedIdx(null)
      return
    }

    // 타일 스왑
    const newTiles = [...activeTiles]
    const firstVal = newTiles[selectedIdx]
    const secondVal = newTiles[clickedIdx]
    newTiles[selectedIdx] = secondVal
    newTiles[clickedIdx] = firstVal

    // 정답 위치 확인
    const wasFirstCorrect = firstVal === selectedIdx
    const wasSecondCorrect = secondVal === clickedIdx
    const isFirstCorrect = newTiles[selectedIdx] === selectedIdx
    const isSecondCorrect = newTiles[clickedIdx] === clickedIdx

    let newlyMatched = 0
    if (!wasFirstCorrect && isFirstCorrect) newlyMatched++
    if (!wasSecondCorrect && isSecondCorrect) newlyMatched++

    if (newlyMatched > 0) {
      playChime('match')
    } else {
      playChime('swap')
    }

    const nextMoves = activeMoves + 1
    const nextProgress = calcProgress(newTiles)
    setSelectedIdx(null)

    if (isRemote) {
      // 🌐 원격 대결: 내 창에서 연속으로 풀며, 양쪽 완료 시 이동 횟수 비교
      if (nextProgress.isComplete) {
        playChime('win')
        let winner = null
        if (oppData.completed) {
          const p1Final = myRole === 'p1' ? nextMoves : p1Data.moves
          const p2Final = myRole === 'p2' ? nextMoves : p2Data.moves
          if (p1Final < p2Final) winner = 'p1'
          else if (p2Final < p1Final) winner = 'p2'
          else winner = 'draw'
        }

        const myNewData = {
          tiles: newTiles,
          moves: nextMoves,
          completed: true,
          time: elapsedSeconds,
          hintUsed: myRole === 'p1' ? p1Data.hintUsed : p2Data.hintUsed,
        }

        onStateChange({
          ...state,
          p1: myRole === 'p1' ? myNewData : p1Data,
          p2: myRole === 'p2' ? myNewData : p2Data,
          winner: winner || null,
        })
      } else {
        const myNewData = {
          ...(myRole === 'p1' ? p1Data : p2Data),
          tiles: newTiles,
          moves: nextMoves,
        }
        onStateChange({
          ...state,
          p1: myRole === 'p1' ? myNewData : p1Data,
          p2: myRole === 'p2' ? myNewData : p2Data,
        })
      }
      return
    }

    // 로컬 모드 (1인 또는 로컬 2인 순차 대결)
    if (nextProgress.isComplete) {
      playChime('win')

      if (mode === 'solo') {
        // 1인 모드: 완성 시 승리 처리 및 가족 포인트 획득
        onStateChange({
          ...state,
          tiles: newTiles,
          moves: nextMoves,
          winner: 'p1',
          clearTime: elapsedSeconds,
        })
      } else if (mode === 'battle') {
        if (battleStage === 'p1') {
          // 2인 대결 1단계 완료 (선수1 기록 저장)
          onStateChange({
            ...state,
            tiles: newTiles,
            moves: nextMoves,
            battleStage: 'p2_ready',
            p1Result: {
              moves: nextMoves,
              seconds: elapsedSeconds,
            },
          })
        } else if (battleStage === 'p2') {
          // 2인 대결 2단계 완료 (선수2 기록 저장 후 이동 횟수 비교하여 승자 결정)
          const p1Moves = state.p1Result?.moves || 999
          const p2Moves = nextMoves
          let winner = 'draw'
          if (p1Moves < p2Moves) winner = 'p1'
          else if (p2Moves < p1Moves) winner = 'p2'

          onStateChange({
            ...state,
            tiles: newTiles,
            moves: nextMoves,
            battleStage: 'result',
            winner,
            p2Result: {
              moves: p2Moves,
              seconds: elapsedSeconds,
            },
          })
        }
      }
    } else {
      // 진행 중
      onStateChange({
        ...state,
        tiles: newTiles,
        moves: nextMoves,
      })
    }
  }

  // 2인 대결 모드에서 선수2 도전 시작
  const handleStartP2Battle = () => {
    const newTiles = shuffleTiles(3)
    setSelectedIdx(null)
    setElapsedSeconds(0)
    setHintActive(false)
    onStateChange({
      ...state,
      tiles: newTiles,
      moves: 0,
      battleStage: 'p2',
      hintUsed: false,
    })
  }

  // 여행지 변경 (이전 / 다음)
  const handleChangeLandmark = (step) => {
    const curIndex = WORLD_LANDMARKS.findIndex((l) => l.id === landmark.id)
    let nextIndex = curIndex + step
    if (nextIndex < 0) nextIndex = WORLD_LANDMARKS.length - 1
    if (nextIndex >= WORLD_LANDMARKS.length) nextIndex = 0
    const nextLandmark = WORLD_LANDMARKS[nextIndex]

    if (onNewGame) {
      onNewGame(nextLandmark.id, mode)
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* 게임 모드 선택 탭 (1인 맞추기 vs 2인 이동횟수 대결) */}
      <div className="w-full grid grid-cols-2 gap-1.5 p-1 bg-surface-muted border border-border rounded-xl mb-3 shadow-xs">
        <button
          type="button"
          onClick={() => handleSwitchMode('solo')}
          className={`py-2 rounded-lg font-display font-bold text-[12px] flex items-center justify-center gap-1.5 transition ${
            mode === 'solo'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <i className="ph-bold ph-user text-[14px]"></i> 1인 모드 (혼자 즐기기)
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode('battle')}
          className={`py-2 rounded-lg font-display font-bold text-[12px] flex items-center justify-center gap-1.5 transition ${
            mode === 'battle'
              ? 'bg-secondary-dark text-on-secondary shadow-xs'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <i className="ph-bold ph-sword text-[14px]"></i> 2인 대결 (이동 횟수 경쟁)
        </button>
      </div>

      {/* 여행지 정보 헤더 */}
      <div className="w-full bg-surface-muted/80 border border-border rounded-xl p-3.5 mb-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-black px-2 py-1 rounded-lg bg-surface border border-border shadow-xs shrink-0 flex items-center justify-center min-w-[34px] text-foreground"
              role="img"
              aria-label={landmark.country}
            >
              {landmark.flag}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                  {landmark.country} {landmark.city}
                </span>
                <span className="text-[11px] text-foreground-muted">{landmark.continent}</span>
              </div>
              <h3 className="text-[16px] font-display font-extrabold text-foreground leading-tight mt-0.5">
                {landmark.name}
              </h3>
            </div>
          </div>

          {/* 여행지 이전/다음 버튼 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleChangeLandmark(-1)}
              className="p-1.5 bg-surface border border-border rounded-lg text-foreground hover:bg-surface-muted active:scale-95 transition"
              title="이전 여행지"
            >
              <i className="ph-bold ph-caret-left text-[14px]"></i>
            </button>
            <button
              type="button"
              onClick={() => handleChangeLandmark(1)}
              className="p-1.5 bg-surface border border-border rounded-lg text-foreground hover:bg-surface-muted active:scale-95 transition"
              title="다음 여행지"
            >
              <i className="ph-bold ph-caret-right text-[14px]"></i>
            </button>
          </div>
        </div>

        {/* 진행도 게이지 & 힌트 버튼 */}
        <div className="flex items-center justify-between text-[12px] font-bold mb-1.5">
          <span className="flex items-center gap-1 text-foreground">
            <i className="ph-bold ph-puzzle-piece text-primary"></i>
            맞춘 조각: <strong className="text-primary">{progress.correctCount}</strong> / {progress.total}
          </span>
          <span className="text-accent font-extrabold">{progress.percentage}% 완성</span>
        </div>
        <div className="h-2.5 bg-surface rounded-full overflow-hidden border border-border/50">
          <div
            className="h-full bg-gradient-to-r from-pastel-sky to-primary rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>

        {/* 게임 상태 바 (시간, 이동 횟수) */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60 text-[12px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-foreground-muted font-medium">
              <i className="ph-bold ph-timer"></i> {formatTime(elapsedSeconds)}
            </span>
            <span className="flex items-center gap-1 text-foreground-muted font-medium">
              <i className="ph-bold ph-arrows-clockwise"></i> {activeMoves}회 이동
            </span>
          </div>

          {/* 대결 모드 기록 현황 표시 */}
          {mode === 'battle' ? (
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md font-display font-bold text-[11px] ${
                  isRemote
                    ? myRole === 'p1' ? 'bg-primary text-on-primary' : 'bg-surface text-foreground-muted border border-border'
                    : battleStage === 'p1' ? 'bg-primary text-on-primary ring-2 ring-primary/30' : 'bg-surface text-foreground-muted border border-border'
                }`}
              >
                {player1}: {isRemote ? (p1Data.completed ? `🎉 ${p1Data.moves}회` : `${p1Data.moves || 0}회 중`) : state?.p1Result ? `${state.p1Result.moves}회` : '도전 전'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-display font-bold text-[11px] ${
                  isRemote
                    ? myRole === 'p2' ? 'bg-secondary-dark text-on-secondary' : 'bg-surface text-foreground-muted border border-border'
                    : battleStage === 'p2' ? 'bg-secondary-dark text-on-secondary ring-2 ring-secondary/30' : 'bg-surface text-foreground-muted border border-border'
                }`}
              >
                {player2}: {isRemote ? (p2Data.completed ? `🎉 ${p2Data.moves}회` : oppJoined ? `${p2Data.moves || 0}회 중` : '대기 중') : state?.p2Result ? `${state.p2Result.moves}회` : '대기 중'}
              </span>
            </div>
          ) : (
            <span className="text-foreground-muted text-[11px] font-bold flex items-center gap-1">
              <i className="ph-bold ph-star text-amber-500"></i> 최소 이동으로 맞춰보세요
            </span>
          )}
        </div>
      </div>

      {/* 로컬 대결 모드일 때 가족 대결 신청 버튼 노출 */}
      {!isRemote && mode === 'battle' && onInviteFamily && (
        <div className="w-full flex justify-end mb-2.5">
          <button
            type="button"
            onClick={() => onInviteFamily('worldpuzzle')}
            className="px-3 py-1.5 bg-pastel-mint border border-foreground/30 text-foreground font-display font-bold text-xs rounded-lg shadow-sticker active:scale-95 transition flex items-center gap-1.5 hover:bg-pastel-mint/80"
          >
            <i className="ph-bold ph-paper-plane-tilt"></i> 💌 가족에게 원격 대결 신청하기
          </button>
        </div>
      )}

      {/* 대결 모드 단계별 안내 배너 */}
      {mode === 'battle' && (
        <div className="w-full bg-surface border border-border rounded-xl p-2.5 mb-2.5 text-center shadow-xs">
          {isRemote ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-display font-black text-primary flex items-center gap-1">
                  🌐 원격 대결 (각자의 창에서 이동 횟수 경쟁)
                </span>
                {state?.winner ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-primary text-on-primary rounded-full">
                    대결 종료
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-surface text-primary border border-primary/30 rounded-full animate-pulse">
                    실시간 진행 중
                  </span>
                )}
              </div>
              {!oppJoined ? (
                <p className="text-xs text-foreground-muted">
                  ⏳ <strong>{oppName}</strong>님의 입장을 기다리고 있어요. 먼저 퍼즐을 시작하셔도 좋아요!
                </p>
              ) : state?.winner ? (
                <p className="text-xs font-bold text-foreground">
                  🏆 최종 결과: {player1} ({p1Data.moves}회) vs {player2} ({p2Data.moves}회) → {state.winner === 'draw' ? '무승부!' : `${state.winner === 'p1' ? player1 : player2} 승리!`}
                </p>
              ) : isComplete ? (
                <p className="text-xs font-bold text-primary">
                  🎉 나는 {activeMoves}회로 완성했어요! 상대방({oppName})의 완성을 기다리는 중...
                </p>
              ) : (
                <p className="text-xs text-foreground-muted">
                  상대방을 신경 쓰지 않고 내 속도대로 가장 적은 이동 횟수로 완성해보세요!
                </p>
              )}
            </div>
          ) : (
            <>
              {battleStage === 'p1' && (
                <p className="text-[12px] font-bold text-foreground">
                  ⚔️ <strong className="text-primary">{player1}</strong>님의 차례! 몇 번 만에 맞출 수 있을까요?
                </p>
              )}
              {battleStage === 'p2_ready' && (
                <div className="flex flex-col items-center gap-2 py-1 animate-fade-in">
                  <p className="text-[13px] font-display font-black text-foreground">
                    🎉 {player1}님 완료! <span className="text-primary font-bold">{state?.p1Result?.moves}회 이동</span> ({formatTime(state?.p1Result?.seconds || 0)})
                  </p>
                  <button
                    type="button"
                    onClick={handleStartP2Battle}
                    className="w-full py-2 bg-secondary-dark text-on-secondary rounded-lg font-display font-bold text-[13px] active:scale-95 transition shadow-xs"
                  >
                    👉 이제 {player2}님 도전하기! ({player1}님의 {state?.p1Result?.moves}회 깨기)
                  </button>
                </div>
              )}
              {battleStage === 'p2' && (
                <p className="text-[12px] font-bold text-foreground">
                  ⚔️ <strong className="text-secondary-dark">{player2}</strong>님의 차례! {player1}님의 <span className="text-primary font-bold">{state?.p1Result?.moves}회</span>보다 적게 성공해보세요!
                </p>
              )}
              {battleStage === 'result' && (
                <p className="text-[12px] font-bold text-foreground">
                  🏁 대결 종료! {player1}: {state?.p1Result?.moves}회 vs {player2}: {state?.p2Result?.moves}회
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* 안내 텍스트 및 힌트 버튼들 */}
      <div className="flex items-center justify-between w-full px-1 mb-2">
        <p className="text-[12px] font-bold text-foreground truncate mr-2">
          {isComplete || state?.winner ? (
            <span className="text-primary font-extrabold">🎉 여행지 퍼즐 완성!</span>
          ) : (
            <span>조각 2개를 골라 맞바꾸며 제자리를 찾아보세요!</span>
          )}
        </p>

        {/* 힌트 버튼들 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 번호 힌트 (한 게임당 1회 제한) */}
          {(() => {
            // 원격 대결에서는 내 역할(p1/p2)의 hintUsed 상태를 사용
            const myHintUsed = isRemote
              ? (myRole === 'p2' ? p2Data.hintUsed : p1Data.hintUsed)
              : Boolean(state?.hintUsed)
            return (
              <button
                type="button"
                onClick={handleUseNumberHint}
                disabled={myHintUsed || hintActive || isComplete || !!state?.winner}
                className={`px-2 py-1 rounded-md text-[11px] font-bold border transition flex items-center gap-1 ${
                  hintActive
                    ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                    : myHintUsed
                      ? 'bg-surface-muted text-foreground-muted border-border/60 opacity-50 cursor-not-allowed'
                      : 'bg-surface text-foreground border-border hover:bg-surface-muted active:scale-95'
                }`}
                title={myHintUsed ? '이번 판 힌트를 이미 사용했습니다' : '한 게임당 1회 6초간 번호가 보여요'}
              >
                {hintActive ? (
                  <>🔢 번호 ({hintSecondsLeft}초)</>
                ) : myHintUsed ? (
                  <>🔢 힌트완료(0/1)</>
                ) : (
                  <>🔢 번호힌트(1회)</>
                )}
              </button>
            )
          })()}

          {/* 원본 사진 힌트 보기 */}
          <button
            type="button"
            onClick={() => setShowOriginalModal(true)}
            className="px-2.5 py-1 bg-surface text-primary border border-primary/30 hover:bg-primary/5 rounded-md text-[11px] font-bold flex items-center gap-1 transition shadow-xs active:scale-95"
          >
            <i className="ph-bold ph-image"></i> 원본 힌트
          </button>
        </div>
      </div>

      {/* 퍼즐 그리드 보드 (3x3) */}
      <div className="relative w-full max-w-[340px] aspect-square bg-slate-200 dark:bg-slate-800 rounded-2xl p-2 shadow-md border-2 border-border overflow-hidden mb-3">
        <div
          className="grid h-full w-full gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          }}
        >
          {activeTiles.map((tileVal, slotIdx) => {
            const isCorrect = tileVal === slotIdx
            const isSelected = selectedIdx === slotIdx

            const origRow = Math.floor(tileVal / gridSize)
            const origCol = tileVal % gridSize
            const posX = (origCol / (gridSize - 1)) * 100
            const posY = (origRow / (gridSize - 1)) * 100

            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => handleTileClick(slotIdx)}
                disabled={!!state?.winner || isComplete || (!isRemote && (!myTurn || battleStage === 'p2_ready'))}
                className={`relative w-full h-full rounded-lg overflow-hidden transition-all duration-200 active:scale-95 focus:outline-none ${
                  isSelected
                    ? 'ring-4 ring-amber-400 scale-[1.04] z-10 shadow-lg'
                    : isCorrect
                      ? 'ring-2 ring-emerald-500/80 shadow-xs'
                      : 'hover:brightness-105'
                }`}
                style={{
                  backgroundImage: `url(${landmark.imageUrl})`,
                  backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                  backgroundPosition: `${posX}% ${posY}%`,
                }}
              >
                {/* 정답 위치 맞춤 표시 (초록 체크 뱃지) */}
                {isCorrect && (
                  <div className="absolute top-1 right-1 bg-emerald-500/90 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] shadow-xs">
                    <i className="ph-bold ph-check"></i>
                  </div>
                )}

                {/* 1회 한정 번호 힌트 활성화 시 표시 (6초 카운트다운) */}
                {hintActive && (
                  <div className="absolute bottom-1 left-1 bg-black/75 backdrop-blur-xs text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-extrabold border border-amber-400/50 animate-pop">
                    {tileVal + 1}
                  </div>
                )}

                {/* 선택된 타일 하이라이트 오버레이 */}
                {isSelected && <div className="absolute inset-0 bg-amber-400/20 border-2 border-amber-400 rounded-lg"></div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 승리 / 완성 메시지 영역 */}
      {(state?.winner || (mode === 'solo' && isComplete) || (isRemote && isComplete)) && (
        <div className="w-full bg-pastel-mint/30 border border-pastel-mint rounded-xl p-3.5 text-center mb-3 animate-fade-in shadow-xs">
          <p className="text-[15px] font-display font-black text-foreground mb-1">
            {mode === 'solo' ? (
              <>🎉 축하합니다! {activeMoves}번의 이동으로 {formatTime(elapsedSeconds)} 만에 {landmark.name}을(를) 완성했어요!</>
            ) : isRemote ? (
              state?.winner ? (
                state?.winner === 'draw' ? (
                  <>🤝 무승부! 두 사람 모두 {p1Data.moves}번의 이동으로 똑같이 완성했어요!</>
                ) : (
                  <>🏆 축하합니다! {state?.winner === 'p1' ? player1 : player2} 승리! ({player1} {p1Data.moves}회 vs {player2} {p2Data.moves}회) 더 적은 이동 횟수로 성공했어요!</>
                )
              ) : (
                <>🎉 내 퍼즐 완성 ({activeMoves}회 이동)! 상대방({oppName})의 완성을 기다리고 있어요...</>
              )
            ) : state?.winner === 'draw' ? (
              <>🤝 무승부! 둘 다 {state?.p1Result?.moves}번 만에 똑같이 멋지게 완성했어요!</>
            ) : (
              <>🏆 축하합니다! {state?.winner === 'p1' ? player1 : player2} 승리! ({state?.winner === 'p1' ? `${player1} ${state?.p1Result?.moves}회 vs ${player2} ${state?.p2Result?.moves}회` : `${player2} ${state?.p2Result?.moves}회 vs ${player1} ${state?.p1Result?.moves}회`}) 더 적은 이동 횟수로 퍼즐을 완성했어요!</>
            )}
          </p>
          <p className="text-[12px] text-foreground-muted leading-relaxed mt-1">{landmark.trivia}</p>
        </div>
      )}

      {/* 하단 액션 버튼들 */}
      <div className="w-full grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNewGame && onNewGame(landmark.id, mode)}
          className="bg-surface-muted border border-border text-foreground hover:bg-surface rounded-xl py-2.5 flex items-center justify-center gap-1.5 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150"
        >
          <i className="ph-bold ph-arrow-counter-clockwise text-[15px]"></i> 다시 섞기
        </button>
        <button
          type="button"
          onClick={() => handleChangeLandmark(1)}
          className="bg-primary text-on-primary hover:bg-primary-dark rounded-xl py-2.5 flex items-center justify-center gap-1.5 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150 shadow-xs"
        >
          <i className="ph-bold ph-airplane-tilt text-[16px]"></i> 다음 여행지
        </button>
      </div>

      {/* 원본 사진 보기 힌트 모달 */}
      {showOriginalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-4 max-w-sm w-full shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black px-2 py-1 rounded-lg bg-surface-muted border border-border shadow-xs shrink-0 flex items-center justify-center min-w-[34px] text-foreground">
                  {landmark.flag}
                </span>
                <div>
                  <h4 className="font-display font-bold text-[15px] text-foreground">{landmark.name}</h4>
                  <p className="text-[11px] text-foreground-muted">
                    {landmark.country} {landmark.city}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOriginalModal(false)}
                className="w-8 h-8 rounded-full bg-surface-muted border border-border flex items-center justify-center text-foreground hover:bg-surface active:scale-90 transition"
              >
                <i className="ph-bold ph-x text-[14px]"></i>
              </button>
            </div>

            {/* 원본 사진 미리보기 */}
            <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 border border-border shadow-inner">
              <img
                src={landmark.imageUrl}
                alt={landmark.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>

            {/* 여행지 상식 설명 */}
            <div className="bg-surface-muted rounded-xl p-3 mb-4 text-[12px] text-foreground-muted leading-relaxed">
              <span className="font-bold text-foreground block mb-1">💡 알고 계셨나요?</span>
              {landmark.trivia}
            </div>

            <button
              type="button"
              onClick={() => setShowOriginalModal(false)}
              className="w-full bg-primary text-on-primary rounded-xl py-2.5 font-display font-bold text-[14px] active:scale-95 transition shadow-xs"
            >
              퍼즐로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
