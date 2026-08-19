import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import TodaySchedule from '../components/TodaySchedule'

function iconForTitle(title) {
  if (/세수|양치|씻/.test(title)) return 'ph-drop-half-bottom'
  if (/가방/.test(title)) return 'ph-backpack'
  if (/물통|물/.test(title)) return 'ph-flask'
  if (/신발|옷|우비/.test(title)) return 'ph-t-shirt'
  return 'ph-sparkle'
}

function headingFor(total, filled) {
  if (total === 0) return '오늘은 할일이 없어요!'
  if (filled === 0) return '오늘 할일을 시작해볼까요?'
  if (filled === total) return '다 했어요! 최고예요!'
  return '우와, 거의 다 했어요!'
}

function ChildTodoScreen() {
  const { memberId } = useParams()
  const { supabase, familyId, members } = useFamily()
  const childName = members.find((m) => m.member_id === memberId)?.name || '아이'

  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [poppedId, setPoppedId] = useState(null)
  const [poppedStar, setPoppedStar] = useState(null)
  const [celebrate, setCelebrate] = useState(false)

  // 자녀를 빠르게 전환하면 먼저 보낸 요청이 나중에 도착해 다른 아이의 목록을
  // 덮어쓸 수 있으므로, 마지막 요청의 응답만 반영한다.
  const reqIdRef = useRef(0)

  const loadTodos = useCallback(async () => {
    if (!familyId || !memberId) return
    const myReq = ++reqIdRef.current
    setLoading(true)
    setErrorMsg('')
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('assignee_member_id', memberId)
      .order('created_at')
      .order('todo_id')
    if (myReq !== reqIdRef.current) return
    if (error) {
      setErrorMsg('할일을 불러오지 못했어요. 잠시 뒤 다시 열어봐요.')
      setLoading(false)
      return
    }
    setTodos(data || [])
    setLoading(false)
  }, [supabase, familyId, memberId])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // 챗봇이 할일을 바꾸면 이 화면은 다시 마운트되지 않으므로 직접 다시 읽는다
  useEffect(() => {
    window.addEventListener('kinship:change', loadTodos)
    return () => window.removeEventListener('kinship:change', loadTodos)
  }, [loadTodos])

  const total = todos.length
  const filled = todos.filter((t) => t.is_done).length
  const remaining = total - filled
  const progressPct = total > 0 ? (filled / total) * 100 : 0

  async function handleToggle(todo) {
    const nextDone = !todo.is_done

    // 자녀에게는 todos 직접 UPDATE 권한이 없다(있으면 is_done만 바꾸도록 제한할 방법이
    // 없어서 제목·담당자까지 바꿀 수 있다). 이 RPC만 열려 있고, completed_by도
    // 클라이언트가 보내는 값이 아니라 서버가 정한다.
    const { data, error } = await supabase.rpc('toggle_my_todo', { p_todo_id: todo.todo_id })

    if (error) {
      setErrorMsg('지금은 저장이 안 됐어요. 다시 눌러볼까요?')
      return
    }
    if (!data?.ok) {
      setErrorMsg(data?.error === 'not_your_todo' ? '이건 내 할일이 아니에요.' : '지금은 저장이 안 됐어요.')
      return
    }

    setErrorMsg('')
    setTodos((prev) => prev.map((t) => (t.todo_id === todo.todo_id ? data.todo : t)))
    // 가족 포인트가 완료 개수에서 계산되므로 알린다. kinship:change를 쓰면
    // 이 화면의 목록 새로고침까지 같이 돌아 진행 애니메이션이 다시 튄다.
    window.dispatchEvent(new CustomEvent('kinship:points'))

    setPoppedId(todo.todo_id)
    // 축하 연출은 체크할 때만 — 해제할 때는 별이 튀지 않아야 한다
    if (nextDone) {
      setPoppedStar(filled)
      setCelebrate(true)
    }
  }

  useEffect(() => {
    if (poppedId === null) return
    const timer = setTimeout(() => setPoppedId(null), 550)
    return () => clearTimeout(timer)
  }, [poppedId])

  useEffect(() => {
    if (poppedStar === null) return
    const timer = setTimeout(() => setPoppedStar(null), 600)
    return () => clearTimeout(timer)
  }, [poppedStar])

  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setCelebrate(false), 400)
    return () => clearTimeout(timer)
  }, [celebrate])

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link
          to={`/child-outfit/${memberId}`}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
          aria-label="옷차림 화면으로"
        >
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <span className="font-display font-bold text-[15px] text-foreground-muted">{childName}</span>
        <div className="w-10"></div>
      </div>

      <TodaySchedule memberId={memberId} memberName={childName} />

      <div className="bg-surface-muted rounded-lg shadow-soft px-5 py-5 mb-6 text-center">
        <h1 className="font-display font-extrabold text-[22px] leading-[28px] text-accent">{headingFor(total, filled)}</h1>
        <p className="font-doodle text-[18px] text-foreground-muted mt-1">
          별 스티커 {filled}/{total}개 모았어요!
        </p>
        <div className="relative mt-4">
          <div className="h-3.5 rounded-full bg-border overflow-hidden flex" aria-hidden="true">
            {todos.map((t, i) => (
              <span
                key={t.todo_id}
                className={`progress-star ${i < filled ? 'is-filled' : ''} ${poppedStar === i ? 'pop' : ''}`}
              ></span>
            ))}
          </div>
          <span
            className="progress-marker w-6 h-6 rounded-full bg-surface border-2 border-foreground shadow-sticker flex items-center justify-center"
            style={{ left: `${progressPct}%` }}
            aria-hidden="true"
          >
            <i className="ph-fill ph-smiley text-[12px] text-tape-yellow"></i>
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-surface border-2 border-destructive rounded-md px-4 py-3 mb-4 flex items-center gap-2">
          <i className="ph-fill ph-warning-circle text-lg text-destructive shrink-0" aria-hidden="true"></i>
          <p className="text-[14px] text-foreground flex-1">{errorMsg}</p>
          <button
            type="button"
            onClick={loadTodos}
            className="text-[13px] font-display font-bold text-primary px-2 py-1 active:scale-95 transition duration-150"
          >
            다시
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-foreground-muted text-center">불러오는 중...</p>
      ) : todos.length === 0 ? (
        <p className="text-foreground-muted text-center">아직 등록된 할일이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {todos.map((t) => (
            <button
              key={t.todo_id}
              type="button"
              onClick={() => handleToggle(t)}
              className="todo-row w-full bg-surface border border-border rounded-full shadow-soft pl-3 pr-4 py-3 flex items-center gap-4 text-left"
              data-done={t.is_done}
              aria-pressed={t.is_done}
            >
              <span
                className={`todo-circle w-11 h-11 rounded-full border-2 border-border bg-surface flex items-center justify-center shrink-0 ${poppedId === t.todo_id ? 'pop' : ''}`}
              >
                <i className={`ph-fill ph-star todo-check text-on-secondary text-lg ${poppedId === t.todo_id ? 'pop' : ''}`}></i>
              </span>
              <span className="todo-label font-display font-bold text-[16px] leading-[22px] flex-1">{t.title}</span>
              <span
                className="w-10 h-10 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <i className={`ph-duotone ${iconForTitle(t.title)} text-lg text-member-3`}></i>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className={`remaining-msg font-doodle text-[19px] text-accent mt-5 text-center ${celebrate ? 'celebrate' : ''}`}>
        {total === 0 ? ' ' : remaining === 0 ? '다 했어요! 오늘도 최고예요!' : `${remaining}개 남았어요, 하나씩 눌러봐요!`}
      </p>

    </>
  )
}

export default ChildTodoScreen
