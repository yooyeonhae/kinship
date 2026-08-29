import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import TodaySchedule from '../components/TodaySchedule'
import {
  CHILD_QUICK_TASKS,
  addMyTodo,
  addTodoMessage,
  computeStreak,
  deleteMyTodo,
  loadStars,
  loadStreakRows,
  splitByDay,
  starsOf,
  todayValue,
} from '../lib/todos'
import {
  DEFAULT_SETTINGS,
  SETTINGS_EVENT,
  loadSettings,
  missionLimitOf,
  purgeOldTodosOnce,
} from '../lib/settings'

function iconForTitle(title) {
  if (/세수|양치|씻/.test(title)) return 'ph-drop-half-bottom'
  if (/가방|준비물/.test(title)) return 'ph-backpack'
  if (/물통|물/.test(title)) return 'ph-flask'
  if (/신발|옷|우비/.test(title)) return 'ph-t-shirt'
  if (/숙제|공부/.test(title)) return 'ph-pencil'
  if (/책|독서/.test(title)) return 'ph-book-open'
  if (/정리|청소/.test(title)) return 'ph-broom'
  return 'ph-sparkle'
}

function headingFor(total, filled) {
  if (total === 0) return '오늘 할일을 정해볼까요?'
  if (filled === 0) return '오늘 할일을 시작해볼까요?'
  if (filled === total) return '다 했어요! 최고예요!'
  return '우와, 거의 다 했어요!'
}

function daysAgoValue(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return todayValue(d)
}

function ChildTodoScreen() {
  const { memberId } = useParams()
  const { supabase, familyId, members, currentMemberId } = useFamily()
  const childName = members.find((m) => m.member_id === memberId)?.name || '아이'
  // 자기 화면일 때만 스스로 할일을 넣을 수 있다. 서버도 acting_member_id()로 자기
  // 담당에만 넣지만, 남의 화면에서 입력칸이 보이면 "넣었는데 저기 있네"가 된다.
  const isMe = Boolean(currentMemberId) && currentMemberId === memberId

  const [todos, setTodos] = useState([])
  const [stars, setStars] = useState(null)
  // 체크는 했지만 아직 부모가 승인하지 않은 개수. 별 합계에는 안 들어간다.
  const [pendingStars, setPendingStars] = useState(0)
  const [streak, setStreak] = useState(0)
  const [goals, setGoals] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [poppedId, setPoppedId] = useState(null)
  const [poppedStar, setPoppedStar] = useState(null)
  const [celebrate, setCelebrate] = useState(false)
  const [addInput, setAddInput] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  // 자녀를 빠르게 전환하면 먼저 보낸 요청이 나중에 도착해 다른 아이의 목록을
  // 덮어쓸 수 있으므로, 마지막 요청의 응답만 반영한다.
  const reqIdRef = useRef(0)

  const loadTodos = useCallback(async () => {
    if (!familyId || !memberId) return
    const myReq = ++reqIdRef.current
    setLoading(true)
    setErrorMsg('')
    // 오늘 것과 최근에 못 한 것만. 예전에는 그 아이의 할일을 전부 불러와서,
    // "오늘 할일"이라 부르면서 실제로는 며칠 치가 한 화면에 섞여 있었다.
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('assignee_member_id', memberId)
      .gte('due_date', daysAgoValue(settings.overdue_days))
      .lte('due_date', todayValue())
      .order('due_date')
      .order('created_at')
      .order('todo_id')
    if (myReq !== reqIdRef.current) return
    if (error) {
      if (/does not exist|schema cache/i.test(error.message || '')) setNeedsMigration(true)
      else setErrorMsg('할일을 불러오지 못했어요. 잠시 뒤 다시 열어봐요.')
      setLoading(false)
      return
    }
    setTodos(data || [])
    setLoading(false)
  }, [supabase, familyId, memberId, settings.overdue_days])

  const refreshStars = useCallback(async () => {
    if (!familyId || !memberId) return
    const [res, streakRes] = await Promise.all([
      loadStars(supabase, memberId, settings.require_approval),
      loadStreakRows(supabase, memberId),
    ])
    if (!res.error) {
      setStars(res.data)
      setPendingStars(res.pending || 0)
    }
    // 연속 달성은 저장하지 않고 매번 계산한다 — 기록을 쌓아두면 나중에 할일을
    // 지웠을 때 기록만 남아 두 값이 어긋난다.
    if (!streakRes.error) setStreak(computeStreak(streakRes.data))
  }, [supabase, familyId, memberId, settings.require_approval])

  const loadGoals = useCallback(async () => {
    if (!familyId || !memberId) return
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('member_id', memberId)
      .is('redeemed_at', null)
      .order('required_points')
    // 보상 목표는 없어도 화면이 돌아가야 한다 — 마이그레이션 전이면 조용히 비운다.
    setGoals(error ? [] : data || [])
  }, [supabase, familyId, memberId])

  useEffect(() => {
    loadTodos()
    refreshStars()
    loadGoals()
  }, [loadTodos, refreshStars, loadGoals])

  // 설정은 가족이 바꿀 수 있으므로 화면을 열 때와 바뀔 때 다시 읽는다.
  const refreshSettings = useCallback(async () => {
    if (!familyId) return
    const res = await loadSettings(supabase)
    setSettings(res.data)
  }, [supabase, familyId])

  useEffect(() => {
    refreshSettings()
    window.addEventListener(SETTINGS_EVENT, refreshSettings)
    return () => window.removeEventListener(SETTINGS_EVENT, refreshSettings)
  }, [refreshSettings])

  // 밀린 할일 정리는 앱을 여는 김에 한 번만. 설정이 0이면 서버가 아무것도 안 한다.
  useEffect(() => {
    if (familyId) purgeOldTodosOnce(supabase)
  }, [supabase, familyId])

  // 챗봇이 할일을 바꾸면 이 화면은 다시 마운트되지 않으므로 직접 다시 읽는다
  useEffect(() => {
    const onChange = () => {
      loadTodos()
      refreshStars()
    }
    window.addEventListener('kinship:change', onChange)
    return () => window.removeEventListener('kinship:change', onChange)
  }, [loadTodos, refreshStars])

  // 부모가 준 것과 내가 정한 것을 나눠 보여준다. 섞어두면 "내가 정한 미션"이라는
  // 감각이 사라지고, 아이가 방금 추가한 것이 목록 어딘가에 묻힌다.
  const { today: todayTodos, given: givenTodos, mission: missionTodos, overdue } = splitByDay(todos)
  const total = todayTodos.length
  const filled = todayTodos.filter((t) => t.is_done).length
  const remaining = total - filled
  const progressPct = total > 0 ? (filled / total) * 100 : 0
  const nextGoal = goals[0]

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
    // 체크만으로는 별이 오르지 않는다(승인이 게이트). 대신 "승인 기다리는 중"이 늘고,
    // 승인된 할일의 체크를 풀면 서버가 도장도 떼므로(migration_19) 별에서 빠진다.
    setStars((prev) =>
      prev === null ? prev : prev - (nextDone ? 0 : starsOf(todo, settings.require_approval))
    )
    if (settings.require_approval) {
      setPendingStars((prev) => Math.max(0, prev + (nextDone ? 1 : todo.approved_by ? 0 : -1)))
    }
    // 연속 달성은 오늘 것을 다 채웠는지에 달려 있어 체크할 때마다 다시 센다.
    refreshStars()
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

  async function handleAdd(title) {
    const value = title.trim()
    if (!value || addBusy) return
    setAddBusy(true)
    const res = await addMyTodo(supabase, value)
    setAddBusy(false)
    if (res.error || res.reason) {
      setAddMsg(addTodoMessage(res.reason, missionLimitOf(settings)))
      return
    }
    setAddMsg('')
    setAddInput('')
    setTodos((prev) => [...prev, res.data])
  }

  async function handleDeleteMine(todo) {
    const res = await deleteMyTodo(supabase, todo.todo_id)
    if (res.error || res.reason) {
      setAddMsg('지우지 못했어요.')
      return
    }
    setAddMsg('')
    setTodos((prev) => prev.filter((t) => t.todo_id !== todo.todo_id))
    if (todo.is_done) {
      setStars((prev) => (prev === null ? prev : prev - starsOf(todo, settings.require_approval)))
      window.dispatchEvent(new CustomEvent('kinship:points'))
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

  function renderRow(t) {
    return (
      <div
        key={t.todo_id}
        className="todo-row w-full bg-surface border border-border rounded-full shadow-soft pl-3 pr-2 py-3 flex items-center gap-3"
        data-done={t.is_done}
      >
        <button
          type="button"
          onClick={() => handleToggle(t)}
          className="flex items-center gap-4 flex-1 min-w-0 text-left"
          aria-pressed={t.is_done}
        >
          <span
            className={`todo-circle w-11 h-11 rounded-full border-2 border-border bg-surface flex items-center justify-center shrink-0 ${poppedId === t.todo_id ? 'pop' : ''}`}
          >
            <i className={`ph-fill ph-star todo-check text-on-secondary text-lg ${poppedId === t.todo_id ? 'pop' : ''}`}></i>
          </span>
          <span className="flex-1 min-w-0">
            <span className="todo-label font-display font-bold text-[16px] leading-[22px] block truncate">
              {t.title}
            </span>
            {t.approved_by ? (
              <span className="text-[12px] font-display font-bold text-accent flex items-center gap-1">
                <span aria-hidden="true">🏅</span>
                부모님이 확인했어요 · 별 +1
              </span>
            ) : t.is_done && settings.require_approval ? (
              <span className="text-[12px] font-display font-bold text-foreground-muted">
                부모님 확인을 기다려요
              </span>
            ) : null}
          </span>
        </button>
        {t.self_made && isMe ? (
          <button
            type="button"
            onClick={() => handleDeleteMine(t)}
            className="w-10 h-10 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
            aria-label={`${t.title} 지우기`}
          >
            <i className="ph-bold ph-trash text-base text-foreground-muted"></i>
          </button>
        ) : (
          <span
            className="w-10 h-10 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <i className={`ph-duotone ${iconForTitle(t.title)} text-lg text-member-3`}></i>
          </span>
        )}
      </div>
    )
  }

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

      {needsMigration && (
        <div className="bg-surface border-2 border-foreground rounded-md px-4 py-3 mb-4">
          <p className="text-[14px] font-display font-bold mb-1">아직 준비가 안 됐어요</p>
          <p className="text-[13px] text-foreground-muted leading-[19px]">
            부모님께 알려주세요 — `migration_18_todo_due_and_stars.sql`을 실행하면 오늘 할일과 별 모으기가 켜져요.
          </p>
        </div>
      )}

      {/* 별 저금통 — 지금까지 모은 별과, 가장 가까운 내 보상 목표.
          예전에는 별이 오늘 진행바 안에서만 살다가 사라져서, 모아도 쓸 데가 없었다. */}
      <div className="bg-surface border-2 border-foreground rounded-md shadow-sticker px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <i className="ph-fill ph-star text-2xl text-tape-yellow" aria-hidden="true"></i>
          <p className="font-display font-extrabold text-[18px] flex-1">
            모은 별 {stars === null ? '…' : stars}개
          </p>
          {/* 연속 달성. 하루치 별보다 오래가는 동기가 된다. 할일이 없던 날은
              건너뛰고, 오늘이 아직 안 끝났으면 끊지 않는다. */}
          {streak > 0 && (
            <span className="shrink-0 flex items-center gap-1 bg-tape-pink/30 border border-foreground rounded-full px-2.5 py-1">
              <span aria-hidden="true">🔥</span>
              <span className="font-display font-extrabold text-[14px]">{streak}일 연속</span>
            </span>
          )}
        </div>
        {pendingStars > 0 && (
          <p className="text-[12px] text-foreground-muted mt-1">
            승인 기다리는 중 {pendingStars}개 · 부모님이 확인하면 별이 돼요
          </p>
        )}
        {nextGoal ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[12px] font-display font-bold mb-1">
              <span className="truncate">다음 목표 · {nextGoal.title}</span>
              <span className="shrink-0 ml-2">
                {Math.min(stars || 0, nextGoal.required_points)} / {nextGoal.required_points}
              </span>
            </div>
            <div className="h-2.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-tape-yellow rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round(((stars || 0) / nextGoal.required_points) * 100))}%`,
                }}
              ></div>
            </div>
            <p className="text-[12px] text-foreground-muted mt-1">
              {(stars || 0) >= nextGoal.required_points
                ? '목표를 채웠어요! 부모님께 말씀드려요.'
                : `${nextGoal.required_points - (stars || 0)}개 더 모으면 돼요.`}
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-foreground-muted mt-1">
            부모님이 별 목표를 정해주시면 여기에 보여요.
          </p>
        )}
      </div>

      <div className="bg-surface-muted rounded-lg shadow-soft px-5 py-5 mb-6 text-center">
        <h1 className="font-display font-extrabold text-[22px] leading-[28px] text-accent">{headingFor(total, filled)}</h1>
        {total > 0 ? (
          <>
            <p className="font-doodle text-[18px] text-foreground-muted mt-1">
              오늘 {filled}/{total}개 했어요!
            </p>
            <div className="relative mt-4">
              <div className="h-3.5 rounded-full bg-border overflow-hidden flex" aria-hidden="true">
                {todayTodos.map((t, i) => (
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
          </>
        ) : (
          // 할일이 하나도 없는 날 빈 막대와 "0/0개"를 띄우면 뭘 해야 하는지 알 수 없다.
          <p className="font-doodle text-[18px] text-foreground-muted mt-1">
            {isMe ? '하고 싶은 일을 아래에서 골라봐요!' : '오늘은 정해진 할일이 없어요.'}
          </p>
        )}
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
      ) : (
        <div className="flex flex-col gap-3">{givenTodos.map(renderRow)}</div>
      )}

      <p className={`remaining-msg font-doodle text-[19px] text-accent mt-5 text-center ${celebrate ? 'celebrate' : ''}`}>
        {total === 0 ? ' ' : remaining === 0 ? '다 했어요! 오늘도 최고예요!' : `${remaining}개 남았어요, 하나씩 눌러봐요!`}
      </p>

      {/* 내가 정한 미션은 접지 않는다 — 추가한 것이 버튼 뒤에 숨으면 "넣었는데
          안 보인다"가 된다. 추가 입력칸과 같은 카드 안에 바로 쌓인다. */}
      {(missionTodos.length > 0 || (isMe && !needsMigration)) && (
        <div className="bg-surface border-2 border-foreground rounded-md shadow-sticker px-4 py-4 mt-2 mb-4">
          <p className="font-display font-bold text-[15px] mb-1 flex items-center gap-1.5">
            <i className="ph-duotone ph-target text-lg text-accent" aria-hidden="true"></i>
            나의 미션 리스트
          </p>
          <p className="text-[12px] text-foreground-muted mb-3">
            내가 정한 일이에요. 다 하고 부모님이 확인하면 별을 받아요.
            {isMe ? ` 오늘은 ${missionLimitOf(settings)}개까지 넣을 수 있어요.` : ''}
          </p>

          {missionTodos.length > 0 && (
            <div className="flex flex-col gap-3 mb-3">{missionTodos.map(renderRow)}</div>
          )}
          {!isMe && missionTodos.length === 0 && (
            <p className="text-[13px] text-foreground-muted">아직 정한 미션이 없어요.</p>
          )}

          {isMe && !needsMigration && (
          <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CHILD_QUICK_TASKS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => handleAdd(q.label)}
                disabled={addBusy}
                className="bg-surface-muted border border-border rounded-full px-3 py-1.5 text-[13px] font-display font-bold flex items-center gap-1 active:scale-95 transition duration-150 disabled:opacity-60"
              >
                <i className={`ph-bold ${q.icon} text-sm`} aria-hidden="true"></i>
                {q.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAdd(addInput)
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="직접 적어도 돼요"
              maxLength={40}
              className="flex-1 bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150 min-w-0"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={addBusy || !addInput.trim()}
              className="px-4 h-11 rounded-md bg-primary text-on-primary border-2 border-foreground shadow-sticker font-display font-bold text-[14px] shrink-0 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
            >
              추가
            </button>
          </form>
          {addMsg && <p className="text-[13px] text-destructive mt-2">{addMsg}</p>}
          </>
          )}
        </div>
      )}

      {/* 지난 못 한 일도 접지 않는다. 오늘 할 일보다 아래에 두는 것으로 충분하고,
          버튼 뒤에 있으면 있는지조차 모른다. */}
      {overdue.length > 0 && (
        <div className="mb-4">
          <p className="font-display font-bold text-[14px] flex items-center gap-1.5 mb-2">
            <i className="ph-bold ph-clock-counter-clockwise text-base text-foreground-muted" aria-hidden="true"></i>
            며칠 전 못 한 일 {overdue.length}개
          </p>
          <div className="flex flex-col gap-3">{overdue.map(renderRow)}</div>
        </div>
      )}
    </>
  )
}

export default ChildTodoScreen
