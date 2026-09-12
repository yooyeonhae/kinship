import { useState } from 'react'
import { KOREAN_WORDS, HANJA_IDIOMS, PROVERBS, getDailyIndex, speakWord } from '../../lib/kidsInfoData'

/**
 * 2-3 (A). 오늘의 순우리말 · 고사성어 · 속담 카드
 * - [ 🌸 순우리말 ] / [ 📜 고사성어 ] / [ 💡 우리 속담 ] 3개 탭 전환
 * - 실제 예문 카드 제공
 * - 발음 듣기 (Web Speech API TTS)
 * - 직접 따라 써보는 미니 입력창
 */
function KoreanWordsCard({ onRemove }) {
  const [tab, setTab] = useState('pure') // 'pure' | 'idiom' | 'proverb'
  const [pureOffset, setPureOffset] = useState(0)
  const [idiomOffset, setIdiomOffset] = useState(0)
  const [proverbOffset, setProverbOffset] = useState(0)
  const [inputVal, setInputVal] = useState('')

  let list = KOREAN_WORDS
  let offset = pureOffset
  let setOffset = setPureOffset
  let tabLabel = '순우리말'

  if (tab === 'idiom') {
    list = HANJA_IDIOMS
    offset = idiomOffset
    setOffset = setIdiomOffset
    tabLabel = '고사성어'
  } else if (tab === 'proverb') {
    list = PROVERBS
    offset = proverbOffset
    setOffset = setProverbOffset
    tabLabel = '우리 속담'
  }

  const currentIndex = getDailyIndex(list.length, offset)
  const currentItem = list[currentIndex]

  // 타이핑 일치 여부 체크
  const isMatch =
    inputVal.trim().replace(/\s+/g, '') === currentItem.word.trim().replace(/\s+/g, '')

  function handleNext() {
    setOffset((prev) => (prev + 1) % list.length)
    setInputVal('')
  }

  function handleSpeak() {
    speakWord(currentItem.word, 'ko-KR')
  }

  return (
    <div className="relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-4 flex flex-col justify-between shrink-0 w-[min(320px,76vw)] snap-start transition-all duration-200 min-h-[350px]">
      <div>
        {/* 상단 3개 탭 & 도구 */}
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex bg-surface-muted p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => {
                setTab('pure')
                setInputVal('')
              }}
              className={`px-1.5 py-1 rounded-md text-[10.5px] font-display font-bold transition ${
                tab === 'pure'
                  ? 'bg-secondary-dark text-on-secondary shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              🌸 순우리말
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('idiom')
                setInputVal('')
              }}
              className={`px-1.5 py-1 rounded-md text-[10.5px] font-display font-bold transition ${
                tab === 'idiom'
                  ? 'bg-secondary-dark text-on-secondary shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              📜 고사성어
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('proverb')
                setInputVal('')
              }}
              className={`px-1.5 py-1 rounded-md text-[10.5px] font-display font-bold transition ${
                tab === 'proverb'
                  ? 'bg-secondary-dark text-on-secondary shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              💡 속담
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition text-foreground-muted"
              title={`다른 ${tabLabel} 보기`}
              aria-label={`다른 ${tabLabel} 보기`}
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

        {/* 단어 / 고사성어 / 속담 카드 본체 */}
        <div className="bg-pastel-yellow/35 border border-amber-300/70 rounded-xl p-3 mb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display font-black text-[19px] text-foreground tracking-tight">
                {currentItem.word}
              </span>
              {currentItem.hanja && (
                <span className="text-[12px] font-bold text-foreground-muted">
                  ({currentItem.hanja})
                </span>
              )}
            </div>

            {/* 발음 듣기 TTS */}
            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-on-primary text-[11px] font-bold shadow-xs active:scale-90 transition shrink-0 ml-1"
              title="발음 듣기"
            >
              <i className="ph-fill ph-speaker-high text-xs"></i>
              <span>듣기</span>
            </button>
          </div>

          <p className="font-display font-bold text-[13px] text-foreground mt-1.5 leading-snug">
            {currentItem.meaning}
          </p>
        </div>

        {/* 실제 예문 카드 */}
        <div className="bg-surface-muted rounded-xl p-2.5 border border-border mb-2.5">
          <p className="text-[11px] font-bold text-foreground-muted flex items-center gap-1 mb-0.5">
            <span>💬</span>
            <span>실제 이렇게 써요:</span>
          </p>
          <p className="text-[12.5px] font-medium leading-[19px] text-foreground">
            &ldquo;{currentItem.example}&rdquo;
          </p>
        </div>

        {/* 직접 따라 써보는 미니 입력창 */}
        <div className="bg-surface rounded-xl border border-border p-2">
          <div className="flex items-center justify-between text-[11px] mb-1 font-bold text-foreground-muted">
            <span>✍️ 직접 따라 써보기</span>
            {isMatch ? (
              <span className="text-success font-black animate-bounce flex items-center gap-0.5">
                <span>잘했어요! 🌟</span>
              </span>
            ) : (
              <span className="text-[10px] text-foreground-muted/70">위 글자를 적어보세요</span>
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
          <span>다른 {tabLabel} 보기 ({currentIndex + 1}/{list.length})</span>
          <i className="ph-bold ph-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default KoreanWordsCard
