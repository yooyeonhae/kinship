import { useCallback, useEffect, useRef, useState } from 'react'
import { approveTodo, dueLabel, todayValue, tomorrowValue } from '../lib/todos'
import { DEFAULT_SETTINGS, SETTINGS_EVENT, loadSettings } from '../lib/settings'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { MEMBER_BG_CLASS, colorTokenForMember } from '../lib/memberColors'
import { characterOf } from '../lib/avatars'
import CharacterPicker from '../components/CharacterPicker'

function ParentTasksScreen() {
  const {
    supabase,
    familyId,
    members,
    loading: membersLoading,
    currentMember,
    isParentAuthed,
    reload,
  } = useFamily()
  const [todos, setTodos] = useState([])
  const [loadingTodos, setLoadingTodos] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [taskInput, setTaskInput] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  // 언제까지 할 일인지. 기본은 오늘 — 대부분이 오늘 것이고, 아이 화면의 "오늘 할일"이
  // 이 값으로 걸러진다(migration_18). 날짜가 없던 때는 며칠 치가 한 화면에 섞였다.
  const [dueDate, setDueDate] = useState(todayValue)
  const [avatarTarget, setAvatarTarget] = useState(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [quickTasks, setQuickTasks] = useState([])
  const [editingQuick, setEditingQuick] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [quickMigrationNeeded, setQuickMigrationNeeded] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

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

  // 별 승인 규칙은 가족 설정에서 온다(migration_21).
  useEffect(() => {
    if (!familyId) return
    let alive = true
    const read = async () => {
      const res = await loadSettings(supabase)
      if (alive) setSettings(res.data)
    }
    read()
    window.addEventListener(SETTINGS_EVENT, read)
    return () => {
      alive = false
      window.removeEventListener(SETTINGS_EVENT, read)
    }
  }, [supabase, familyId])

  // 챗봇이 할일을 바꾸면 이 화면은 다시 마운트되지 않으므로 직접 다시 읽는다
  useEffect(() => {
    window.addEventListener('kinship:change', loadTodos)
    return () => window.removeEventListener('kinship:change', loadTodos)
  }, [loadTodos])

  const loadQuickTasks = useCallback(async () => {
    if (!familyId) return
    const { data, error } = await supabase
      .from('quick_tasks')
      .select('*')
      .order('sort_order')
      .order('created_at')
    if (error) {
      if (error.code === '42P01' || /schema cache|does not exist/i.test(error.message)) setQuickMigrationNeeded(true)
      return
    }
    setQuickMigrationNeeded(false)
    setQuickTasks(data || [])
  }, [supabase, familyId])

  useEffect(() => {
    loadQuickTasks()
  }, [loadQuickTasks])

  async function addQuickTask(title) {
    const v = title.trim()
    if (!v) return
    // 같은 걸 두 번 넣으면 칩이 나란히 겹쳐 보이기만 하고 도움이 안 된다
    if (quickTasks.some((q) => q.title === v)) {
      setErrorMsg('이미 있는 항목이에요.')
      return
    }
    const { data, error } = await supabase
      .from('quick_tasks')
      .insert({ family_id: familyId, title: v, sort_order: quickTasks.length })
      .select()
      .single()
    if (error) {
      setErrorMsg('항목을 추가하지 못했어요.')
      return
    }
    setErrorMsg('')
    setQuickTasks((prev) => [...prev, data])
  }

  async function removeQuickTask(quick) {
    const { error } = await supabase.from('quick_tasks').delete().eq('quick_task_id', quick.quick_task_id)
    if (error) {
      setErrorMsg('항목을 지우지 못했어요.')
      return
    }
    setErrorMsg('')
    setQuickTasks((prev) => prev.filter((q) => q.quick_task_id !== quick.quick_task_id))
  }

  function memberName(id) {
    return members.find((m) => m.member_id === id)?.name || null
  }

  async function addTask(title) {
    const v = title.trim()
    if (!v) return
    const { data, error } = await supabase
      .from('todos')
      .insert({ family_id: familyId, title: v, assignee_member_id: assigneeId || null, due_date: dueDate })
      .select()
      .single()
    if (error) {
      setErrorMsg(
        /does not exist|schema cache/i.test(error.message || '')
          ? '할일에 날짜를 쓰려면 migration_18_todo_due_and_stars.sql을 실행해주세요.'
          : '할일을 추가하지 못했어요.'
      )
      return
    }
    setErrorMsg('')
    setTodos((prev) => [...prev, data])
  }

  // 아이가 끝낸 할일을 부모가 확인해 주는 도장. **이 도장을 찍어야 아이의 별에
  // 합산된다** — 체크는 아이가 혼자 누르는 것이라, 별이 보상으로 바뀌는 값이라면
  // 확인하는 사람이 있어야 한다. 한 번 더 누르면 떼진다(잘못 찍었을 때 되돌릴 길).
  async function toggleApprove(todo) {
    const res = await approveTodo(supabase, todo.todo_id)
    if (res.error || res.reason) {
      setErrorMsg(
        res.reason === 'parent_only'
          ? '인정 도장은 부모만 찍을 수 있어요.'
          : res.reason === 'not_done'
            ? '아직 끝나지 않은 할일이에요.'
            : '도장을 찍지 못했어요. migration_19를 실행했는지 확인해주세요.'
      )
      return
    }
    setErrorMsg('')
    setTodos((prev) => prev.map((t) => (t.todo_id === todo.todo_id ? res.data : t)))
    // 아이의 별이 바뀌었으니 보상 카드가 다시 읽어야 한다
    window.dispatchEvent(new CustomEvent('kinship:points'))
  }

  async function toggleTask(todo) {
    // 완료자를 서버가 정하도록 자녀 화면과 같은 RPC를 쓴다.
    // 클라이언트가 completed_by를 보내면 "누가 끝냈는지"를 클라이언트가 주장하는 셈이 된다.
    const { data, error } = await supabase.rpc('toggle_my_todo', { p_todo_id: todo.todo_id })
    if (error) {
      setErrorMsg('상태를 바꾸지 못했어요.')
      return
    }
    if (!data?.ok) {
      setErrorMsg('상태를 바꾸지 못했어요.')
      return
    }
    setErrorMsg('')
    setTodos((prev) => prev.map((t) => (t.todo_id === todo.todo_id ? data.todo : t)))
    // 가족 포인트가 완료 개수에서 계산되므로 알린다. kinship:change를 쓰면
    // 이 화면의 목록 새로고침까지 같이 돌아 진행 애니메이션이 다시 튄다.
    window.dispatchEvent(new CustomEvent('kinship:points'))

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

  const avatarMember = members.find((m) => m.member_id === avatarTarget) || null

  async function saveAvatar(member, emoji) {
    const { error } = await supabase.from('members').update({ avatar: emoji }).eq('member_id', member.member_id)
    if (error) {
      // avatar 열이 없으면 migration_11을 아직 실행하지 않은 것이다
      setErrorMsg(
        /column|schema cache/i.test(`${error.message} ${error.details}`)
          ? '캐릭터 기능은 migration_11을 실행한 뒤에 쓸 수 있어요.'
          : '캐릭터를 저장하지 못했어요.'
      )
      return
    }
    setErrorMsg('')
    // members는 FamilyContext가 들고 있으므로 그쪽을 다시 읽어야 다른 화면에도 반영된다
    await reload()
  }

  const remainingTotal = parents.reduce((sum, p) => sum + todos.filter((t) => t.assignee_member_id === p.member_id && !t.is_done).length, 0)

  const today = todayValue()
  // ① 미완료 (날짜 오래된 것 먼저, 긴급한 것이 위에)
  const todosUndone = todos.filter((t) => !t.is_done)
  // ② 오늘 완료
  const todosDoneToday = todos.filter((t) => t.is_done && t.due_date === today)
  // ③ 지난 날 완료 (숨김 처리 대상)
  const todosDonePast = todos.filter((t) => t.is_done && t.due_date !== today)

  function renderTaskRow(t) {
    const name = memberName(t.assignee_member_id)
    const token = t.assignee_member_id ? colorTokenForMember(members, t.assignee_member_id) : null
    const assignee = members.find((m) => m.member_id === t.assignee_member_id) || null
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
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {t.due_date && t.due_date !== todayValue() && (
              <span
                className={`text-[12px] font-display font-bold px-1.5 py-0.5 rounded ${
                  t.due_date < todayValue() && !t.is_done
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-surface-muted text-foreground-muted'
                }`}
              >
                {dueLabel(t.due_date)}
              </span>
            )}
            {t.self_made && (
              <span className="text-[12px] font-display font-bold px-1.5 py-0.5 rounded bg-tape-yellow/40 text-foreground">
                스스로 정함
              </span>
            )}
            {t.approved_by ? (
              <span className="text-[12px] font-display font-bold text-accent">🏅 확인함 · 별 +1</span>
            ) : t.is_done && t.assignee_member_id && settings.require_approval ? (
              <span className="text-[12px] font-display font-bold text-destructive">확인 기다림 · 별 아직 0</span>
            ) : null}
            {t.is_done && (
              <span className="text-[13px] text-foreground-muted">
                완료: {memberName(t.completed_by) || name || '가족'}
              </span>
            )}
          </span>
        </div>
        <span
          className={`w-9 h-9 rounded-full ${token ? MEMBER_BG_CLASS[token] : 'bg-surface-muted border border-border'} ring-2 ring-surface shadow-soft flex items-center justify-center text-[17px] shrink-0`}
          title={name ? `${name}${t.is_done ? ' 완료' : ', 아직 완료 안 함'}` : '담당자 미정'}
        >
          <span aria-hidden="true">{assignee ? characterOf(assignee) : '❓'}</span>
        </span>
        {t.is_done && isParentAuthed && settings.require_approval && (
          <button
            type="button"
            onClick={() => toggleApprove(t)}
            className={`shrink-0 rounded-full flex items-center justify-center gap-1 border-2 active:scale-90 transition duration-150 ${
              t.approved_by
                ? 'w-8 h-8 bg-tape-yellow border-foreground'
                : 'px-2.5 h-8 bg-primary text-on-primary border-foreground shadow-sticker'
            }`}
            aria-label={t.approved_by ? `${t.title} 확인 취소` : `${t.title} 확인하고 별 주기`}
            title={
              t.approved_by
                ? '확인했어요 — 별 +1 (다시 누르면 취소)'
                : '확인하면 아이 별에 합산돼요'
            }
          >
            <span aria-hidden="true">🏅</span>
            {!t.approved_by && <span className="font-display font-bold text-[12px]">별 주기</span>}
          </button>
        )}
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
  }

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
        <span className="font-display font-bold text-[15px] text-foreground-muted">
          부모{currentMember ? ` · ${currentMember.name}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <Link
            to="/outfit-settings"
            className="w-10 h-10 flex items-center justify-center text-[22px] active:scale-90 transition duration-150"
            aria-label="요일별 지정복 설정"
          >
            <span aria-hidden="true">👕</span>
          </Link>
          <Link
            to="/child-schedule"
            className="w-10 h-10 flex items-center justify-center text-[22px] active:scale-90 transition duration-150"
            aria-label="아이 요일별 스케줄"
          >
            <span aria-hidden="true">📅</span>
          </Link>
          <Link
            to="/parent-progress"
            className="w-10 h-10 flex items-center justify-center text-[22px] active:scale-90 transition duration-150"
            aria-label="완료 현황 보기"
          >
            <span aria-hidden="true">👨‍👩‍👧</span>
          </Link>
        </div>
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
                    <div className="w-16 h-16 rounded-full bg-surface ring-4 ring-surface shadow-soft flex items-center justify-center text-[30px]">
                      <span aria-hidden="true">{characterOf(m)}</span>
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
        {/* 자주 쓰는 항목 제목 위에 있던 워시테이프. 거기서는 글자를 가려서 이 카드 아래로 옮겼다. */}
        <span
          className="absolute -bottom-2 right-5 w-12 h-5 bg-tape-pink/90 rotate-[4deg] rounded-sm shadow-sm"
          aria-hidden="true"
        ></span>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-[13px] font-display font-bold text-accent">
            <i className="ph-fill ph-bell text-base"></i>
            <span>{remainingTotal}개 할일 남음</span>
          </span>
        </div>
      </div>

      <div className="relative mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted">
            자주 쓰는 항목 — 눌러서 바로 추가
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingQuick((v) => !v)
              setQuickInput('')
            }}
            className="text-[12px] font-display font-bold text-primary shrink-0 active:scale-95 transition duration-150"
          >
            {editingQuick ? '완료' : '고치기'}
          </button>
        </div>

        {quickMigrationNeeded && (
          <p className="text-[12px] text-destructive mb-2 leading-[18px]">
            자주 쓰는 항목을 고치려면 Supabase SQL Editor에서 <strong>migration_13_quick_tasks.sql</strong>을 실행해주세요.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {quickTasks.length === 0 ? (
            <span className="text-[13px] text-foreground-muted">
              {editingQuick ? '아래에 자주 쓰는 항목을 적어 추가해보세요.' : '자주 쓰는 항목이 없어요. "고치기"로 추가할 수 있어요.'}
            </span>
          ) : (
            quickTasks.map((q) => (
              <span
                key={q.quick_task_id}
                className="inline-flex items-center bg-surface border border-border rounded-full text-[14px] font-display font-bold overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => addTask(q.title)}
                  disabled={editingQuick}
                  className="inline-flex items-center gap-1.5 pl-3 pr-3 py-2 active:scale-95 transition duration-150 disabled:opacity-60"
                >
                  <i className="ph-bold ph-plus text-primary"></i>
                  {q.title}
                </button>
                {editingQuick && (
                  <button
                    type="button"
                    onClick={() => removeQuickTask(q)}
                    className="pr-3 pl-1 py-2 text-foreground-muted active:scale-90 transition duration-150"
                    aria-label={`${q.title} 항목 지우기`}
                  >
                    <i className="ph-bold ph-x text-[12px]"></i>
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {editingQuick && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addQuickTask(quickInput)
              setQuickInput('')
            }}
            className="flex items-center gap-2 mb-3"
          >
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="자주 쓰는 항목 추가 — 예: 분리수거"
              maxLength={40}
              className="flex-1 min-w-0 bg-surface rounded-md px-3 py-2 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />
            <button
              type="submit"
              className="w-9 h-9 rounded-md bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
              aria-label="자주 쓰는 항목 추가"
            >
              <i className="ph-bold ph-plus text-base"></i>
            </button>
          </form>
        )}
        {/* 담당자와 언제까지. 마감일 기본값은 오늘이라 평소에는 손댈 일이 없고,
            내일 준비물처럼 미리 넣어둘 때만 바꾼다. */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
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
          {[
            { label: '오늘', value: todayValue() },
            { label: '내일', value: tomorrowValue() },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setDueDate(opt.value)}
              className={`rounded-full px-3 py-2 text-[13px] font-display font-bold border transition duration-150 ${
                dueDate === opt.value
                  ? 'bg-secondary-dark text-on-secondary border-foreground'
                  : 'bg-surface-muted text-foreground-muted border-border'
              }`}
              aria-pressed={dueDate === opt.value}
            >
              {opt.label}
            </button>
          ))}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value || todayValue())}
            className="bg-surface-muted rounded-full px-3 py-2 text-[13px] font-display font-bold border border-border outline-none"
            aria-label="마감 날짜"
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addTask(taskInput)
            setTaskInput('')
          }}
          className="bg-tape-yellow border-2 border-foreground rounded-md shadow-sticker px-4 py-3 flex items-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="목록에 없으면 직접 입력하기"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-foreground placeholder:text-foreground/60 outline-none"
            autoComplete="off"
          />
          {/* 예전에는 이 자리가 장식용 span이라 엔터로만 등록됐다. 눌러서 등록되는 게
              눈에 보이는 대로의 동작이고, 모바일 키보드에서 엔터를 찾는 수고도 없앤다. */}
          <button
            type="submit"
            disabled={!taskInput.trim()}
            className="w-9 h-9 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150 disabled:opacity-40"
            aria-label="할일 추가"
          >
            <i className="ph-bold ph-plus text-lg"></i>
          </button>
        </form>
      </div>

      {/* 캐릭터를 바꾸는 일은 자주 있는 일이 아닌데 카드로 놓으니 할일 화면의 자리를
          크게 먹었다. 평소엔 한 줄로 접어두고, 바꿀 때만 편다. 지우지 않는 이유는
          온보딩 이후 캐릭터를 바꿀 수 있는 곳이 여기뿐이라서다. */}
      <div className="bg-surface border border-border rounded-md px-3 py-2.5 mb-6">
        <button
          type="button"
          onClick={() => setAvatarOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 active:scale-[0.99] transition duration-150"
          aria-expanded={avatarOpen}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[15px]" aria-hidden="true">🎭</span>
            <span className="font-display font-bold text-[13px] text-foreground-muted">가족 캐릭터</span>
            <span className="flex items-center -space-x-1" aria-hidden="true">
              {members.slice(0, 5).map((m) => (
                <span key={m.member_id} className="text-[15px]">
                  {characterOf(m)}
                </span>
              ))}
            </span>
          </span>
          <i
            className={`ph-bold ${avatarOpen ? 'ph-caret-up' : 'ph-caret-down'} text-sm text-foreground-muted shrink-0`}
            aria-hidden="true"
          ></i>
        </button>

        {avatarOpen && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {members.map((m) => (
                <button
                  key={m.member_id}
                  type="button"
                  onClick={() => setAvatarTarget(avatarTarget === m.member_id ? null : m.member_id)}
                  className={`inline-flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 text-[13px] font-display font-bold border transition duration-150 ${
                    avatarTarget === m.member_id
                      ? 'bg-secondary-dark text-on-secondary border-foreground'
                      : 'bg-surface-muted text-foreground border-border'
                  }`}
                  aria-expanded={avatarTarget === m.member_id}
                >
                  <span className="text-[15px]" aria-hidden="true">{characterOf(m)}</span>
                  {m.name}
                </button>
              ))}
            </div>

            {avatarMember ? (
              <>
                <p className="text-[12px] text-foreground-muted mb-2">{avatarMember.name}의 띠 캐릭터를 골라주세요.</p>
                <CharacterPicker
                  value={avatarMember.avatar || ''}
                  onSelect={(emoji) => saveAvatar(avatarMember, emoji)}
                  size="sm"
                />
              </>
            ) : (
              <p className="text-[12px] text-foreground-muted">이름을 누르면 캐릭터를 바꿀 수 있어요.</p>
            )}
          </div>
        )}
      </div>

      {loadingTodos ? (
        <p className="text-foreground-muted text-center py-4">불러오는 중...</p>
      ) : (
        <>
          {/* ── ① 미완료 할일 (가장 위) ── */}
          {todosUndone.length === 0 && todosDoneToday.length === 0 && todosDonePast.length === 0 && (
            <p className="text-foreground-muted text-center py-4 text-[14px]">할일이 없어요. 위에서 추가해보세요!</p>
          )}

          <div className="flex flex-col gap-3">
            {[...todosUndone, ...todosDoneToday].map((t) => renderTaskRow(t))}
          </div>

          {/* ── ② 지난 날 완료 항목 (맨 아래, 흐리게) ── */}
          {todosDonePast.length > 0 && (
            <div className="mt-4">
              <p className="font-display font-bold text-[12px] text-foreground-muted flex items-center gap-1.5 mb-2">
                <i className="ph-bold ph-clock-counter-clockwise text-sm" aria-hidden="true"></i>
                지난 날 완료한 일 {todosDonePast.length}개
              </p>
              <div className="flex flex-col gap-3 opacity-50">
                {todosDonePast.map((t) => renderTaskRow(t))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex-1"></div>
      <Link to="/parent-progress" className="mt-6 flex items-center justify-center gap-2 text-secondary font-display font-bold text-[15px] py-2">
        부부 완료 현황 보기
        <i className="ph-bold ph-arrow-right"></i>
      </Link>

    </>
  )
}

export default ParentTasksScreen
