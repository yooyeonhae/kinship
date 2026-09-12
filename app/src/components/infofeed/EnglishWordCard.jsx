import { useState } from 'react'
import { ENGLISH_WORDS, getDailyIndex, speakWord } from '../../lib/kidsInfoData'

/**
 * 2-3 (B). 오늘의 실생활 영단어/표현 카드 (완전 독립 카드)
 * - 학교 생활 및 감정 표현과 관련된 실생활 영어 표현
 * - 실제 대화 예문 카드
 * - 원어민 영어 발음 듣기 (Web Speech API TTS)
 * - 직접 따라 써보는 미니 입력창
 */
function EnglishWordCard({ onRemove }) {
  const [offset, setOffset] = useState(0)
  const [inputVal, setInputVal] = useState('')

  const currentIndex = getDailyIndex(ENGLISH_WORDS.length, offset)
  const currentItem = ENGLISH_WORDS[currentIndex]

  // 타이핑 일치 여부 (대소문자 무시, 공백 정리)
  const isMatch =
    inputVal.trim().toLowerCase().replace(/\s+/g, ' ') ===
    currentItem.word.trim().toLowerCase().replace(/\s+/g, ' ')

  function handleNext() {
    setOffset((prev) => (prev + 1) % ENGLISH_WORDS.length)
    setInputVal('')
  }

  function handleSpeak() {
    speakWord(currentItem.word, 'en-US')
  }

  return (
    <div className="relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-4 flex flex-col justify-between shrink-0 w-[min(320px,76vw)] snap-start transition-all duration-200 min-h-[350px]">
      <div>
        {/* 상단 헤더 & 도구 */}
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pastel-sky/80 border border-foreground/30 text-[11px] font-display font-black text-foreground">
            <span>🔤</span>
            <span>실생활 영어 표현</span>
          </span>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition text-foreground-muted"
              title="다른 영어 표현 보기"
              aria-label="다른 영어 표현 보기"
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

        {/* 영어 표현 카드 본체 */}
        <div className="bg-pastel-mint/40 border border-teal-300/70 rounded-xl p-3 mb-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-black text-[20px] text-foreground tracking-tight">
              {currentItem.word}
            </span>

            {/* 원어민 발음 듣기 TTS 버튼 */}
            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-dark text-on-secondary text-[11px] font-bold shadow-xs active:scale-90 transition shrink-0 ml-1"
              title="영어 발음 듣기"
            >
              <i className="ph-fill ph-speaker-high text-xs"></i>
              <span>발음 듣기</span>
            </button>
          </div>

          <p className="text-[12px] text-foreground-muted mt-0.5 font-medium">
            [{currentItem.pronunciation}]
          </p>

          <p className="font-display font-bold text-[13.5px] text-foreground mt-1.5 leading-snug">
            {currentItem.meaning}
          </p>
        </div>

        {/* 실제 예문 카드 */}
        <div className="bg-surface-muted rounded-xl p-2.5 border border-border mb-2.5">
          <p className="text-[11px] font-bold text-foreground-muted flex items-center gap-1 mb-0.5">
            <span>💬</span>
            <span>이렇게 말해봐요:</span>
          </p>
          <p className="text-[12.5px] font-medium leading-[19px] text-foreground font-display">
            &ldquo;{currentItem.example}&rdquo;
          </p>
        </div>

        {/* 직접 영어 따라 써보기 미니 입력창 */}
        <div className="bg-surface rounded-xl border border-border p-2">
          <div className="flex items-center justify-between text-[11px] mb-1 font-bold text-foreground-muted">
            <span>✍️ 직접 영어 따라 써보기</span>
            {isMatch ? (
              <span className="text-success font-black animate-bounce flex items-center gap-0.5">
                <span>Good Job! 🌟</span>
              </span>
            ) : (
              <span className="text-[10px] text-foreground-muted/70">스펠링을 적어보세요</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`"${currentItem.word}" 입력하기`}
              className={`flex-1 min-w-0 bg-surface-muted rounded-lg px-2.5 py-1.5 text-[13px] border outline-none font-bold transition ${
                isMatch
                  ? 'border-success bg-success/10 text-success'
                  : 'border-border focus:border-foreground'
              }`}
              autoComplete="off"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => setInputVal('')}
                className="w-6 h-6 rounded-full text-foreground-muted hover:text-foreground flex items-center justify-center text-xs"
              >
                <i className="ph-bold ph-x"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 하단 다음 버튼 */}
      <div className="mt-2.5">
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-2 bg-surface hover:bg-surface-muted border border-border rounded-xl text-[12px] font-display font-bold text-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition shadow-xs"
        >
          <span>다른 영어 표현 보기 ({currentIndex + 1}/{ENGLISH_WORDS.length})</span>
          <i className="ph-bold ph-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default EnglishWordCard
