import { useState } from 'react'
import { SCIENCE_TRIVIA, getDailyIndex } from '../../lib/kidsInfoData'

/**
 * 2-2. 오늘의 과학·우주 한 줄 (Kid-friendly Trivia)
 * - 흥미 위주의 자연/과학 상식 제공
 * - '왜 그럴까요?' 아코디언 토글 UI로 원리 설명
 */
function ScienceTriviaCard({ onRemove }) {
  const [offset, setOffset] = useState(0)
  const [showReason, setShowReason] = useState(false)

  const currentIndex = getDailyIndex(SCIENCE_TRIVIA.length, offset)
  const item = SCIENCE_TRIVIA[currentIndex]

  function nextTrivia() {
    setOffset((prev) => (prev + 1) % SCIENCE_TRIVIA.length)
    setShowReason(false)
  }

  return (
    <div className="relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-4.5 flex flex-col justify-between shrink-0 w-[min(320px,76vw)] snap-start transition-all duration-200 min-h-[350px]">
      <div>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pastel-sky/80 border border-foreground/30 text-[11px] font-display font-black text-foreground">
            <span>🚀</span>
            <span>과학 · 우주 한 줄</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={nextTrivia}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition text-foreground-muted"
              title="다른 과학 상식 보기"
              aria-label="다른 과학 상식 보기"
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

        {/* 분야 태그 */}
        <p className="text-[12px] font-display font-bold text-secondary-dark flex items-center gap-1 mb-1.5">
          <i className="ph-bold ph-planet text-sm"></i>
          <span>{item.topic}</span>
        </p>

        {/* 오늘의 핵심 한 줄 상식 */}
        <div className="bg-surface-muted border-2 border-dashed border-border rounded-xl p-3.5 mb-3">
          <p className="font-display font-black text-[16px] leading-[24px] text-foreground">
            &ldquo;{item.statement}&rdquo;
          </p>
        </div>

        {/* '왜 그럴까요?' 아코디언 토글 버튼 */}
        <button
          type="button"
          onClick={() => setShowReason((prev) => !prev)}
          className={`w-full py-2.5 px-3 rounded-xl border font-display font-bold text-[13px] flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
            showReason
              ? 'bg-secondary-dark text-on-secondary border-foreground shadow-xs'
              : 'bg-pastel-mint/50 hover:bg-pastel-mint text-foreground border-foreground/30'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>🤔</span>
            <span>{showReason ? '원리 접어두기' : '왜 그럴까요? (원리 알아보기)'}</span>
          </span>
          <i className={`ph-bold ph-caret-${showReason ? 'up' : 'down'} text-sm`}></i>
        </button>

        {/* 아코디언 내용 영역 */}
        {showReason && (
          <div className="mt-2 p-3 bg-pastel-sky/30 border border-primary/20 rounded-xl text-[13px] leading-[20px] text-foreground animate-fadeIn">
            <p className="font-bold text-primary text-[12px] mb-1">🔍 {item.question}</p>
            <p className="text-foreground/90 font-medium">{item.explanation}</p>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="mt-3">
        <button
          type="button"
          onClick={nextTrivia}
          className="w-full py-2 bg-surface hover:bg-surface-muted border border-border rounded-xl text-[12px] font-display font-bold text-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition shadow-xs"
        >
          <span>다른 호기심 상식 보기 ({currentIndex + 1}/{SCIENCE_TRIVIA.length})</span>
          <i className="ph-bold ph-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default ScienceTriviaCard
