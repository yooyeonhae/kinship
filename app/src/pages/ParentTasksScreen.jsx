import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { MEMBER_BG_CLASS, colorTokenForMember } from '../lib/memberColors'

// 냉장고 재료는 Supabase 스키마에 없는 화면 전용 더미 항목 — 이번 연동 범위(가족 할일)에서 제외
const INITIAL_FRIDGE = [
  { id: 'f1', name: '우유' },
  { id: 'f2', name: '계란' },
  { id: 'f3', name: '소세지' },
  { id: 'f4', name: '두부' },
  { id: 'f5', name: '애호박' },
]

const QUICK_CHIPS = ['우유 사기', '쓰레기 버리기', '준비물 확인']

let nextFridgeId = 100

function ParentTasksScreen() {
  const { supabase, familyId, members, loading: membersLoading } = useFamily()
  const [todos, setTodos] = useState([])
  const [loadingTodos, setLoadingTodos] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [taskInput, setTaskInput] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  const [fridge, setFridge] = useState(INITIAL_FRIDGE)
  const [fridgeInput, setFridgeInput] = useState('')

  const parents = members.filter((m) => m.role === 'parent')

  // 마지막으로 보낸 요청의 응답만 반영해 순서가 뒤바뀐 응답이 목록을 덮어쓰지 않게 한다
  const reqIdRef = useRef(0)

  const loadTodos = useCallback(async () => {
    if (!familyId) return
    const myReq = ++reqIdRef.current
    setLoadingTodos(true)
    const { data, error } = await supabase.from('todos').select('*').order('created_at').order('todo_id')
    if (myReq !== reqIdRef.current) return
    if (error) {
      setErrorMsg('할일을 불러오지 못했어요.')
      setLoadingTodos(false)
      return
    }
    setErrorMsg('')
    setTodos(data || [])
    setLoadingTodos(false)
  }, [supabase, familyId])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  function memberName(id) {
    return members.find((m) => m.member_id === id)?.name || null
  }

  async function addTask(title) {
    const v = title.trim()
    if (!v) return
    const { data, error } = await supabase
      .from('todos')
      .insert({ family_id: familyId, title: v, assignee_member_id: assigneeId || null })
      .select()
      .single()
    if (error) {
      setErrorMsg('할일을 추가하지 못했어요.')
      return
    }
    setErrorMsg('')
    setTodos((prev) => [...prev, data])
  }

  async function toggleTask(todo) {
    const nextDone = !todo.is_done
    const patch = {
      is_done: nextDone,
      completed_by: nextDone ? todo.assignee_member_id : null,
      completed_at: nextDone ? new Date().toISOString() : null,
    }
    const { data, error } = await supabase.from('todos').update(patch).eq('todo_id', todo.todo_id).select().single()
    if (error) {
      setErrorMsg('상태를 바꾸지 못했어요.')
      return
    }
    setErrorMsg('')
    setTodos((prev) => prev.map((t) => (t.todo_id === todo.todo_id ? data : t)))
  }

  async function removeTask(id) {
    const { error } = await supabase.from('todos').delete().eq('todo_id', id)
    if (error) {
      setErrorMsg('삭제하지 못했어요.')
      return
    }
    setErrorMsg('')
    setTodos((prev) => prev.filter((t) => t.todo_id !== id))
  }

  function addFridgeItem(name) {
    const v = name.trim()
    if (!v) return
    setFridge((prev) => [...prev, { id: `f${nextFridgeId++}`, name: v }])
  }

  function removeFridgeItem(id) {
    setFridge((prev) => prev.filter((f) => f.id !== id))
  }

  const remainingTotal = parents.reduce((sum, p) => sum + todos.filter((t) => t.assignee_member_id === p.member_id && !t.is_done).length, 0)
  const needsAttentionCount = todos.filter((t) => !t.is_done).length

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/parent-recipe"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
          aria-label="레시피 화면으로"
        >
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <span className="font-display font-bold text-[15px] text-foreground-muted">부모</span>
        <Link
          to="/parent-progress"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
          aria-label="완료 현황 보기"
        >
          <i className="ph-duotone ph-users-three text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display font-extrabold text-[28px] leading-[34px] text-foreground">
          오늘의 할일 <span className="text-foreground-muted font-body font-normal text-[15px]">Today's Chaos</span>
        </h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">
          누가 뭘 끝냈는지 한눈에 보여요. 자주 쓰는 항목은 탭 한 번으로 바로 추가돼요.
        </p>
      </div>

      {errorMsg && <p className="text-[13px] text-destructive mb-3">{errorMsg}</p>}

      <div className="relative bg-surface-muted border-2 border-foreground rounded-md shadow-sticker px-4 py-4 mb-6">
        <div className="absolute top-3 right-4 flex items-center gap-1 text-tape-yellow" aria-hidden="true">
          <i className="ph-fill ph-star text-lg"></i>
          <i className="ph-fill ph-star text-lg"></i>
        </div>
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3 flex items-center gap-1.5">
          <i className="ph-bold ph-users-three text-base"></i>완료 현황 (TEAM STATUS)
        </p>
        {membersLoading ? (
          <p className="text-foreground-muted text-[14px] mb-4">불러오는 중...</p>
        ) : parents.length === 0 ? (
          <p className="text-foreground-muted text-[14px] mb-4">등록된 부모가 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {parents.map((m) => {
              const mine = todos.filter((t) => t.assignee_member_id === m.member_id)
              const done = mine.filter((t) => t.is_done).length
              const total = mine.length
              const percent = total ? Math.round((done / total) * 100) : 0
              const allDone = total > 0 && done === total
              return (
                <div key={m.member_id} className="relative border border-dashed border-border rounded-lg py-4 px-2 flex flex-col items-center gap-2.5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-surface ring-4 ring-surface shadow-soft flex items-center justify-center">
                      <i className="ph-fill ph-user text-2xl text-foreground-muted" aria-hidden="true"></i>
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ring-2 ring-surface flex items-center justify-center ${
                        allDone ? 'bg-secondary-dark' : 'bg-surface-muted border border-border'
                      }`}
                      aria-hidden="true"
                    >
                      <i className={`ph-bold ${allDone ? 'ph-check text-on-secondary' : 'ph-hourglass text-foreground-muted'} text-[11px]`}></i>
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-display font-bold text-white ${MEMBER_BG_CLASS[colorTokenForMember(members, m.member_id)]}`}>
                    {m.name}
                    {total ? `: ${percent}%` : ' · 할일 없음'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-[13px] font-display font-bold text-accent">
            <i className="ph-fill ph-bell text-base"></i>
            <span>{remainingTotal}개 할일 남음</span>
          </span>
        </div>
      </div>

      <div className="relative mb-5">
        <span className="absolute -top-2 left-2 w-11 h-5 bg-tape-pink/90 rotate-[-5deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-2">자주 쓰는 항목 — 눌러서 바로 추가</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_CHIPS.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => addTask(title)}
              className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full pl-3 pr-4 py-2 text-[14px] font-display font-bold active:scale-95 transition duration-150"
            >
              <i className="ph-bold ph-plus text-primary"></i>
              {title}
            </button>
          ))}
        </div>
        <div className="mb-2">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="bg-surface-muted rounded-full px-3 py-2 text-[13px] font-display font-bold border border-border outline-none"
          >
            <option value="">담당자 미정</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addTask(taskInput)
            setTaskInput('')
          }}
          className="bg-tape-yellow border-2 border-foreground rounded-md shadow-sticker px-4 py-3 flex items-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          <span className="w-9 h-9 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0" aria-hidden="true">
            <i className="ph-bold ph-plus text-lg"></i>
          </span>
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="목록에 없으면 직접 입력하기"
            className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-foreground/60 outline-none"
            autoComplete="off"
          />
        </form>
      </div>

      <div className="relative bg-accent/10 border border-dashed border-accent rounded-md px-4 py-3 mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-accent">
          <i className="ph-fill ph-warning-circle text-lg"></i>
          <span className="font-display font-bold text-[13px] tracking-wide">NEEDS ATTENTION ({needsAttentionCount})</span>
        </span>
      </div>

      {loadingTodos ? (
        <p className="text-foreground-muted text-center py-4">불러오는 중...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {todos.map((t) => {
            const name = memberName(t.assignee_member_id)
            const token = t.assignee_member_id ? colorTokenForMember(members, t.assignee_member_id) : null
            return (
              <div
                key={t.todo_id}
                className="task-row relative overflow-hidden bg-surface border border-border rounded-lg shadow-soft px-4 py-4 flex items-center gap-4"
                data-done={t.is_done}
              >
                <span className="task-corner absolute top-0 right-0 w-8 h-8 bg-border" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} aria-hidden="true"></span>
                <button
                  type="button"
                  onClick={() => toggleTask(t)}
                  className="task-circle w-11 h-11 rounded-full border-2 border-border flex items-center justify-center shrink-0"
                  aria-label={t.is_done ? '완료 취소' : '완료 체크'}
                >
                  <i className="ph-bold ph-check task-check text-on-secondary text-lg"></i>
                  <i className="ph-bold ph-x task-cross text-destructive text-lg" aria-hidden="true"></i>
                </button>
                <div className="flex-1 min-w-0">
                  <span className="task-label font-display font-bold text-[16px]">{t.title}</span>
                  {t.is_done && <p className="text-[13px] text-foreground-muted mt-0.5">완료: {name || '가족'}</p>}
                </div>
                <span
                  className={`w-8 h-8 rounded-full ${token ? MEMBER_BG_CLASS[token] : 'bg-surface-muted border border-border'} ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold ${token ? 'text-on-primary' : 'text-foreground-muted'} shrink-0`}
                  title={name ? `${name}${t.is_done ? ' 완료' : ', 아직 완료 안 함'}` : '담당자 미정'}
                >
                  {name ? name.charAt(0) : '?'}
                </span>
                <button
                  type="button"
                  onClick={() => removeTask(t.todo_id)}
                  className="task-remove w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                  aria-label="삭제"
                >
                  <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="relative bg-surface-muted border border-border rounded-lg px-4 py-4 mt-6 rotate-[-1deg]">
        <span className="absolute -top-2 left-6 w-11 h-5 bg-tape-lime/90 rotate-[-4deg] rounded-sm shadow-sm" aria-hidden="true"></span>
        <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3 flex items-center gap-1.5">
          <i className="ph-duotone ph-refrigerator text-base"></i>냉장고 재료
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {fridge.length === 0 ? (
            <span className="text-foreground-muted text-[14px]">냉장고가 비어있어요.</span>
          ) : (
            fridge.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full pl-3 pr-2 py-1.5 text-[14px] font-body">
                {f.name}
                <button
                  type="button"
                  onClick={() => removeFridgeItem(f.id)}
                  className="w-5 h-5 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
                  aria-label={`${f.name} 삭제`}
                >
                  <i className="ph-bold ph-x text-[11px] text-foreground-muted"></i>
                </button>
              </span>
            ))
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addFridgeItem(fridgeInput)
            setFridgeInput('')
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={fridgeInput}
            onChange={(e) => setFridgeInput(e.target.value)}
            placeholder="재료 이름 입력 후 추가"
            className="flex-1 bg-surface rounded-md px-3 py-2 text-[14px] border border-border outline-none"
            autoComplete="off"
          />
          <button
            type="submit"
            className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
            aria-label="냉장고에 추가"
          >
            <i className="ph-bold ph-plus text-base"></i>
          </button>
        </form>
      </div>

      <div className="flex-1"></div>
      <Link to="/parent-progress" className="mt-6 flex items-center justify-center gap-2 text-secondary font-display font-bold text-[15px] py-2">
        부부 완료 현황 보기
        <i className="ph-bold ph-arrow-right"></i>
      </Link>
    </>
  )
}

export default ParentTasksScreen
