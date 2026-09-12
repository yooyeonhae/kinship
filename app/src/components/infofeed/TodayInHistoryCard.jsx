import { useState } from 'react'
import { HISTORY_EVENTS, getDailyIndex } from '../../lib/kidsInfoData'

/**
 * 2-1. 오늘의 역사 속 오늘 (Today in History)
 * - 짧은 플래시 카드 형태로 스크롤 없이 가볍게 읽도록 구성
 * - 아이들 눈높이에 맞춘 역사적 사건 소개 및 다른 이야기 넘기기 지원
 */
function TodayInHistoryCard({ onRemove }) {
  const [offset, setOffset] = useState(0)
  const currentIndex = getDailyIndex(HISTORY_EVENTS.length, offset)
  const event = HISTORY_EVENTS[currentIndex]

  function nextStory() {
    setOffset((prev) => (prev + 1) % HISTORY_EVENTS.length)
  }

  return (
    <div className="relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-4.5 flex flex-col justify-between shrink-0 w-[min(320px,76vw)] snap-start transition-all duration-200 min-h-[350px]">
      {/* 카드 헤더 */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tape-yellow/70 border border-foreground/30 text-[11px] font-display font-black text-foreground">
            <span>📜</span>
            <span>역사 속 오늘</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={nextStory}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition text-foreground-muted"
              title="다른 역사 이야기 보기"
              aria-label="다른 역사 이야기 보기"
            >
              <i className="ph-bold ph-arrow-clockwise text-base"></i>
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-destructive/10 hover:text-destructive active:scale-90 transition text-foreground-muted"
                title="카테고리 삭제"
                aria-label="카테고리 삭제"
              >
                <i className="ph-bold ph-trash text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* 시기 & 날짜 */}
        <p className="text-[12px] font-display font-bold text-primary flex items-center gap-1 mb-1">
          <i className="ph-fill ph-sparkle text-xs"></i>
          <span>{event.period} ({event.dateLabel})</span>
        </p>

        {/* 메인 사건 제목 */}
        <h3 className="font-display font-extrabold text-[17px] leading-snug text-foreground mb-3">
          {event.title}
        </h3>

        {/* 플래시 카드 본문 요약 */}
        <div className="bg-surface-muted rounded-xl p-3 border border-border text-[13px] leading-[21px] text-foreground font-medium mb-3">
          {event.summary}
        </div>
      </div>

      {/* 하단 펀팩트 & 페이지 넘기기 버튼 */}
      <div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-2 mb-3">
          <p className="text-[11px] font-bold text-primary flex items-start gap-1">
            <span className="shrink-0">💡</span>
            <span className="leading-tight">{event.funFact}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={nextStory}
          className="w-full py-2 bg-surface hover:bg-surface-muted border border-border rounded-xl text-[12px] font-display font-bold text-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition shadow-xs"
        >
          <span>다른 날 역사 보기 ({currentIndex + 1}/{HISTORY_EVENTS.length})</span>
          <i className="ph-bold ph-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default TodayInHistoryCard
