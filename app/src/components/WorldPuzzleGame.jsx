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
}) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [showNumberHints, setShowNumberHints] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const landmark = getLandmarkById(state?.destinationId)
  const gridSize = state?.gridSize || 3
  const tiles = state?.tiles || []
  const progress = calcProgress(tiles)

  // 타이머 (진행 중일 때만 증가)
  useEffect(() => {
    if (state?.winner || progress.isComplete) return
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [state?.winner, progress.isComplete, state?.roundId])

  // 새 라운드 시작 시 타이머 및 선택 상태 리셋
  useEffect(() => {
    setElapsedSeconds(0)
    setSelectedIdx(null)
  }, [state?.roundId])

  // 퍼즐 타일 클릭 시 처리
  const handleTileClick = (clickedIdx) => {
    if (state?.winner || progress.isComplete || !myTurn) return

    if (selectedIdx === null) {
      // 첫 번째 타일 선택
      setSelectedIdx(clickedIdx)
      playChime('swap')
      return
    }

    if (selectedIdx === clickedIdx) {
      // 같은 타일 다시 클릭 시 선택 해제
      setSelectedIdx(null)
      return
    }

    // 두 번째 타일 클릭 시 두 조각의 위치 맞교환 (Swap)
    const newTiles = [...tiles]
    const firstVal = newTiles[selectedIdx]
    const secondVal = newTiles[clickedIdx]
    newTiles[selectedIdx] = secondVal
    newTiles[clickedIdx] = firstVal

    // 이번 스왑으로 새롭게 제자리를 찾은 조각 수 계산
    const beforeFirstMatch = firstVal === selectedIdx
    const beforeSecondMatch = secondVal === clickedIdx
    const afterFirstMatch = newTiles[selectedIdx] === selectedIdx
    const afterSecondMatch = newTiles[clickedIdx] === clickedIdx

    let gainedPoints = 0
    if (!beforeFirstMatch && afterFirstMatch) gainedPoints++
    if (!beforeSecondMatch && afterSecondMatch) gainedPoints++

    if (gainedPoints > 0) {
      playChime('match')
    } else {
      playChime('swap')
    }

    const curTurn = state.turn || 'p1'
    const nextTurn = curTurn === 'p1' ? 'p2' : 'p1'
    const updatedScores = {
      ...state.scores,
      [curTurn]: (state.scores?.[curTurn] || 0) + gainedPoints,
    }

    const nextProgress = calcProgress(newTiles)
    let winner = null
    if (nextProgress.isComplete) {
      playChime('win')
      if (state.mode === 'coop') {
        winner = 'draw' // 협동 모드는 가족 모두의 승리
      } else {
        const p1Score = updatedScores.p1 || 0
        const p2Score = updatedScores.p2 || 0
        if (p1Score > p2Score) winner = 'p1'
        else if (p2Score > p1Score) winner = 'p2'
        else winner = curTurn // 동점일 경우 마지막 조각을 완성한 사람이 승리
      }
    }

    setSelectedIdx(null)
    onStateChange({
      ...state,
      tiles: newTiles,
      scores: updatedScores,
      moves: (state.moves || 0) + 1,
      turn: winner ? curTurn : nextTurn,
      winner,
      lastAction: {
        who: curTurn,
        gainedPoints,
      },
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
      onNewGame(nextLandmark.id)
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="w-full flex flex-col items-center">
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

        {/* 게임 상태 바 (시간, 이동 횟수, 턴 대전 현황) */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60 text-[12px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-foreground-muted">
              <i className="ph-bold ph-timer"></i> {formatTime(elapsedSeconds)}
            </span>
            <span className="flex items-center gap-1 text-foreground-muted">
              <i className="ph-bold ph-arrows-clockwise"></i> {state?.moves || 0}회 이동
            </span>
          </div>

          {/* 2인 턴 대전 점수 현황 */}
          {state?.mode !== 'coop' ? (
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md font-display font-bold text-[11px] ${
                  state?.turn === 'p1' && !state?.winner
                    ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                    : 'bg-surface text-foreground-muted border border-border'
                }`}
              >
                {player1}: {state?.scores?.p1 || 0}점
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-display font-bold text-[11px] ${
                  state?.turn === 'p2' && !state?.winner
                    ? 'bg-accent text-white ring-2 ring-accent/30'
                    : 'bg-surface text-foreground-muted border border-border'
                }`}
              >
                {player2}: {state?.scores?.p2 || 0}점
              </span>
            </div>
          ) : (
            <span className="text-primary font-bold text-[11px] flex items-center gap-1">
              <i className="ph-bold ph-users-three"></i> 가족 협동 완성 중
            </span>
          )}
        </div>
      </div>

      {/* 안내 텍스트: 내 차례 여부 & 조각 맞바꾸기 안내 */}
      <div className="flex items-center justify-between w-full px-1 mb-2">
        <p className="text-[12px] font-bold text-foreground">
          {state?.winner ? (
            <span className="text-primary font-extrabold">🎉 여행지 퍼즐 완성!</span>
          ) : (
            <span>
              {state?.mode === 'coop' ? (
                '조각 두 개를 차례로 탭해 제자리를 찾아보세요!'
              ) : (
                <>
                  <strong className={state?.turn === 'p1' ? 'text-primary' : 'text-accent'}>
                    {state?.turn === 'p1' ? player1 : player2}
                  </strong>
                  님의 차례 — 조각 2개를 골라 맞바꿔요!
                </>
              )}
            </span>
          )}
        </p>

        {/* 힌트 버튼들 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowNumberHints((prev) => !prev)}
            className={`px-2 py-1 rounded-md text-[11px] font-bold border transition ${
              showNumberHints
                ? 'bg-secondary-dark text-on-secondary border-secondary-dark'
                : 'bg-surface text-foreground-muted border-border hover:bg-surface-muted'
            }`}
            title="조각 번호 힌트 보기"
          >
            🔢 번호 힌트
          </button>
          <button
            type="button"
            onClick={() => setShowOriginalModal(true)}
            className="px-2.5 py-1 bg-surface text-primary border border-primary/30 hover:bg-primary/5 rounded-md text-[11px] font-bold flex items-center gap-1 transition shadow-xs"
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
          {tiles.map((tileVal, slotIdx) => {
            const isCorrect = tileVal === slotIdx
            const isSelected = selectedIdx === slotIdx

            // 원래 위치(행, 열) 계산하여 배경 위치 매핑
            const origRow = Math.floor(tileVal / gridSize)
            const origCol = tileVal % gridSize
            const posX = (origCol / (gridSize - 1)) * 100
            const posY = (origRow / (gridSize - 1)) * 100

            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => handleTileClick(slotIdx)}
                disabled={!!state?.winner || !myTurn}
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

                {/* 번호 힌트 오버레이 (1~9) */}
                {showNumberHints && (
                  <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[10px] font-extrabold">
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
      {state?.winner && (
        <div className="w-full bg-pastel-mint/30 border border-pastel-mint rounded-xl p-3 text-center mb-3 animate-fade-in">
          <p className="text-[15px] font-display font-black text-foreground mb-1">
            {state?.mode === 'coop'
              ? `축하합니다! 가족이 힘을 합쳐 ${landmark.name}을(를) 완성했어요!`
              : state?.winner === 'draw'
                ? `무승부! 두 사람 모두 멋지게 퍼즐을 완성했어요!`
                : `축하합니다! ${state?.winner === 'p1' ? player1 : player2} 승리! 더 많은 조각을 맞췄어요.`}
          </p>
          <p className="text-[12px] text-foreground-muted">{landmark.trivia}</p>
        </div>
      )}

      {/* 하단 액션 버튼들 */}
      <div className="w-full grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNewGame && onNewGame(landmark.id)}
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
