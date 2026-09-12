import { useState } from 'react'
import { NONSENSE_QUIZZES, HAVRUTA_QUESTIONS, getDailyIndex } from '../../lib/kidsInfoData'

/**
 * 2-4. 오늘의 생각 질문 & 넌센스 퀴즈 (순서: 생각 질문 먼저, 넌센스 퀴즈 뒤)
 * - 생각 질문(하브루타) ↔ 넌센스 퀴즈 탭 전환 (생각 질문 기본 선택)
 * - 정답이 없는 열린 생각 질문과 미니 생각 적기 및 아지트 공유
 * - 넌센스 퀴즈 풀기 및 정답 확인 토글
 */
function QuizAndThoughtCard({ onRemove }) {
  // 생각 질문이 앞에 먼저 나오도록 기본값 'havruta' 설정
  const [tab, setTab] = useState('havruta') // 'havruta' | 'quiz'
  const [havrutaOffset, setHavrutaOffset] = useState(0)
  const [quizOffset, setQuizOffset] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [thoughtAnswer, setThoughtAnswer] = useState('')
  const [copied, setCopied] = useState(false)

  const isHavruta = tab === 'havruta'
  const havrutaIndex = getDailyIndex(HAVRUTA_QUESTIONS.length, havrutaOffset)
  const quizIndex = getDailyIndex(NONSENSE_QUIZZES.length, quizOffset)

  const havruta = HAVRUTA_QUESTIONS[havrutaIndex]
  const quiz = NONSENSE_QUIZZES[quizIndex]

  function nextItem() {
    if (isHavruta) {
      setHavrutaOffset((prev) => (prev + 1) % HAVRUTA_QUESTIONS.length)
      setThoughtAnswer('')
      setCopied(false)
    } else {
      setQuizOffset((prev) => (prev + 1) % NONSENSE_QUIZZES.length)
      setShowAnswer(false)
    }
  }

  function copyThoughtToClipboard() {
    const text = `[오늘의 가족 하브루타 질문]\n질문: ${havruta.prompt}\n내 생각: ${thoughtAnswer || '(아직 답변 전이에요!)'}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative bg-surface border-2 border-foreground rounded-2xl shadow-sticker p-4 flex flex-col justify-between shrink-0 w-[min(320px,76vw)] snap-start transition-all duration-200 min-h-[350px]">
      <div>
        {/* 상단 탭 (1순위: 생각 질문, 2순위: 넌센스 퀴즈) */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="inline-flex bg-surface-muted p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => {
                setTab('havruta')
                setCopied(false)
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-display font-bold transition ${
                tab === 'havruta'
                  ? 'bg-secondary-dark text-on-secondary shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              💭 생각 질문
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('quiz')
                setShowAnswer(false)
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-display font-bold transition ${
                tab === 'quiz'
                  ? 'bg-secondary-dark text-on-secondary shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              🤣 넌센스 퀴즈
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={nextItem}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition text-foreground-muted"
              title={isHavruta ? '다른 생각 질문 보기' : '다른 퀴즈 보기'}
              aria-label="다른 질문/퀴즈 보기"
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

        {/* 탭 1: 생각 질문 (하브루타/사고력 - 우선 표시) */}
        {isHavruta ? (
          <div>
            <div className="bg-pastel-sky/35 border border-primary/25 rounded-xl p-3 mb-2.5">
              <span className="text-[11px] font-bold text-primary mb-1 inline-block">
                🌱 정답이 없는 열린 질문
              </span>
              <p className="font-display font-black text-[15px] text-foreground leading-snug">
                &ldquo;{havruta.prompt}&rdquo;
              </p>
              <p className="text-[11px] text-foreground-muted mt-1.5 font-medium">
                {havruta.guide}
              </p>
            </div>

            {/* 미니 답변 작성 및 가족 공유 */}
            <div className="bg-surface rounded-xl border border-border p-2">
              <textarea
                rows={2}
                value={thoughtAnswer}
                onChange={(e) => setThoughtAnswer(e.target.value)}
                placeholder="내 생각을 짧게 적어보세요..."
                className="w-full bg-surface-muted rounded-lg p-2 text-[13px] border border-border outline-none resize-none font-medium"
              />
              <button
                type="button"
                onClick={copyThoughtToClipboard}
                className="w-full mt-1.5 py-1.5 bg-secondary-dark text-on-secondary rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
              >
                <i className="ph-bold ph-share-network"></i>
                <span>{copied ? '복사 완료! 아지트에 공유해 보세요' : '가족에게 내 생각 공유하기'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* 탭 2: 넌센스 퀴즈 */
          <div>
            <div className="bg-tape-pink/20 border border-pink-300/60 rounded-xl p-3 mb-2.5">
              <span className="text-[11px] font-bold text-accent mb-1 inline-block">
                Q. 오늘의 수수께끼
              </span>
              <p className="font-display font-black text-[16px] text-foreground leading-snug">
                {quiz.question}
              </p>
              <p className="text-[11px] text-foreground-muted mt-1.5 font-medium">
                💡 힌트: {quiz.hint}
              </p>
            </div>

            {/* 정답 확인 토글 */}
            {!showAnswer ? (
              <button
                type="button"
                onClick={() => setShowAnswer(true)}
                className="w-full py-2.5 bg-primary text-on-primary font-display font-bold text-[13px] rounded-xl border-2 border-foreground shadow-xs active:translate-x-0.5 active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
              >
                <span>정답 확인하기 👀</span>
              </button>
            ) : (
              <div className="bg-surface-muted border-2 border-primary/40 rounded-xl p-3 text-center animate-fadeIn">
                <span className="text-[11px] font-bold text-foreground-muted">정답은 바로!</span>
                <p className="font-display font-black text-[19px] text-primary mt-0.5">
                  &ldquo;{quiz.answer}&rdquo; {quiz.emoji}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAnswer(false)}
                  className="text-[11px] text-foreground-muted underline mt-1"
                >
                  정답 다시 가리기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 다음 버튼 */}
      <div className="mt-2.5">
        <button
          type="button"
          onClick={nextItem}
          className="w-full py-2 bg-surface hover:bg-surface-muted border border-border rounded-xl text-[12px] font-display font-bold text-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition shadow-xs"
        >
          <span>
            {isHavruta
              ? `다른 생각 질문 보기 (${havrutaIndex + 1}/${HAVRUTA_QUESTIONS.length})`
              : `다른 퀴즈 풀기 (${quizIndex + 1}/${NONSENSE_QUIZZES.length})`}
          </span>
          <i className="ph-bold ph-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default QuizAndThoughtCard
