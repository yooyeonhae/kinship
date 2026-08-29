import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import {
  DAY_ORDER,
  alarmLabel,
  byTime,
  ensureNotificationPermission,
  formatTime,
  toDateInputValue,
  todayKey,
} from '../lib/schedules'

// 자주 쓰는 묶음. "월수금 태권도"를 요일 세 번 눌러 고르는 것보다 이게 빠르고,
// 무엇보다 평일 5개를 하나씩 누르다 하나 빠뜨리는 실수가 없어진다.
const DAY_PRESETS = [
  { label: '평일', days: ['월', '화', '수', '목', '금'] },
  { label: '주말', days: ['토', '일'] },
  { label: '매일', days: ['월', '화', '수', '목', '금', '토', '일'] },
]

const ALARM_OPTIONS = [
  { value: '', label: '알림 없음' },
  { value: '0', label: '시작할 때' },
  { value: '5', label: '5분 전' },
  { value: '10', label: '10분 전' },
  { value: '15', label: '15분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
]

function emptyDraft(memberId) {
  return {
    memberId: memberId || '',
    title: '',
    repeatType: 'weekly',
    // 매주 반복은 여러 요일을 고를 수 있다. 스키마의 day_of_week는 한 칸이라
    // 고른 요일마다 한 행씩 넣는다(migration_09의 schedules_when_check를 건드리지 않는다).
    days: [todayKey()],
    scheduleDate: toDateInputValue(),
    startTime: '17:00',
    alarmMinutes: '10',
  }
}

function ChildScheduleScreen() {
  const { supabase, familyId, members } = useFamily()
  const children = useMemo(() => members.filter((m) => m.role === 'child'), [members])

  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [selectedChild, setSelectedChild] = useState('')
  const [draft, setDraft] = useState(() => emptyDraft(''))
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notifyState, setNotifyState] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )

  useEffect(() => {
    if (!children.length) return
    setSelectedChild((prev) => (children.some((c) => c.member_id === prev) ? prev : children[0].member_id))
  }, [children])

  useEffect(() => {
    setDraft((prev) => (prev.memberId ? prev : emptyDraft(selectedChild)))
  }, [selectedChild])

  const load = useCallback(async () => {
    if (!familyId) return
    const { data, error } = await supabase.from('schedules').select('*')
    if (error) {
      if (error.code === '42P01' || /schema cache|does not exist/i.test(error.message)) setNeedsMigration(true)
      else setErrorMsg('스케줄을 불러오지 못했어요.')
      setLoading(false)
      return
    }
    setErrorMsg('')
    setSchedules(data || [])
    setLoading(false)
  }, [supabase, familyId])

  useEffect(() => {
    load()
  }, [load])

  const mine = schedules.filter((s) => s.member_id === selectedChild)
  const weekly = DAY_ORDER.map((day) => ({
    day,
    items: mine.filter((s) => s.repeat_type === 'weekly' && s.day_of_week === day).sort(byTime),
  }))
  const onceItems = mine
    .filter((s) => s.repeat_type === 'once')
    .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date) || byTime(a, b))

  function resetForm() {
    setDraft(emptyDraft(selectedChild))
    setEditingId(null)
  }

  function startEdit(schedule) {
    setEditingId(schedule.schedule_id)
    setDraft({
      memberId: schedule.member_id,
      title: schedule.title,
      repeatType: schedule.repeat_type,
      days: [schedule.day_of_week || todayKey()],
      scheduleDate: schedule.schedule_date || toDateInputValue(),
      startTime: schedule.start_time.slice(0, 5),
      alarmMinutes: schedule.alarm_minutes === null ? '' : String(schedule.alarm_minutes),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) {
      setErrorMsg('일정 이름을 입력해주세요.')
      return
    }
    if (!draft.memberId) {
      setErrorMsg('자녀를 선택해주세요.')
      return
    }
    // 고른 요일은 화면 순서(월~일)로 맞춰둔다. 누른 순서대로 넣으면 같은 선택인데도
    // 목록에 들어가는 순서가 달라져, 무엇이 저장됐는지 눈으로 맞추기 어렵다.
    const pickedDays = DAY_ORDER.filter((d) => draft.days.includes(d))
    if (draft.repeatType === 'weekly' && !pickedDays.length) {
      setErrorMsg('요일을 하나 이상 골라주세요.')
      return
    }
    setBusy(true)

    // 반복이면 요일만, 하루짜리면 날짜만 채운다 — schedules_when_check가 둘 다 차 있는 걸 막는다
    const base = {
      family_id: familyId,
      member_id: draft.memberId,
      title,
      repeat_type: draft.repeatType,
      schedule_date: draft.repeatType === 'once' ? draft.scheduleDate : null,
      start_time: draft.startTime,
      alarm_minutes: draft.alarmMinutes === '' ? null : Number(draft.alarmMinutes),
    }

    // 같은 아이·같은 이름·같은 시간이 그 요일에 이미 있으면 넣지 않는다. 요일을
    // 두 번 고르는 실수로 같은 일정이 겹쳐 쌓이면 알림도 두 번 뜬다.
    const alreadyOn = (day) =>
      schedules.some(
        (x) =>
          x.schedule_id !== editingId &&
          x.member_id === draft.memberId &&
          x.repeat_type === 'weekly' &&
          x.day_of_week === day &&
          x.title === title &&
          x.start_time.slice(0, 5) === draft.startTime
      )

    let error = null
    if (draft.repeatType === 'once') {
      const payload = { ...base, day_of_week: null }
      const res = editingId
        ? await supabase.from('schedules').update(payload).eq('schedule_id', editingId)
        : await supabase.from('schedules').insert(payload)
      error = res.error
    } else {
      // 고친 일정은 첫 요일로 바꾸고, 늘어난 요일은 새 행으로 넣는다.
      const [first, ...rest] = pickedDays
      const extra = (editingId ? rest : pickedDays).filter((d) => !alreadyOn(d))
      if (editingId) {
        const res = await supabase
          .from('schedules')
          .update({ ...base, day_of_week: first })
          .eq('schedule_id', editingId)
        error = res.error
      }
      if (!error && extra.length) {
        const res = await supabase.from('schedules').insert(extra.map((d) => ({ ...base, day_of_week: d })))
        error = res.error
      }
      if (!error && !editingId && !extra.length) {
        setBusy(false)
        setErrorMsg('고른 요일에 이미 같은 일정이 있어요.')
        return
      }
    }

    setBusy(false)
    if (error) {
      setErrorMsg(error.code === '42501' ? '스케줄 등록은 부모만 할 수 있어요.' : '저장하지 못했어요.')
      return
    }
    setErrorMsg('')
    resetForm()
    load()
  }

  async function remove(schedule) {
    const { error } = await supabase.from('schedules').delete().eq('schedule_id', schedule.schedule_id)
    if (error) {
      setErrorMsg('삭제하지 못했어요.')
      return
    }
    load()
  }

  async function askNotification() {
    setNotifyState(await ensureNotificationPermission())
  }

  const wantsAlarm = draft.alarmMinutes !== ''

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link to="/parent-tasks" className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150" aria-label="할일 화면으로">
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <span className="font-display font-bold text-[15px] text-foreground-muted">요일별 스케줄</span>
        <div className="w-10"></div>
      </div>

      <div className="mb-6">
        <h1 className="font-display font-extrabold text-[26px] leading-[32px]">
          <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">아이 스케줄</span>
        </h1>
        <p className="text-foreground-muted text-[14px] leading-[21px] mt-2">
          매주 되풀이되는 일정은 한 번만 넣어두면 그 요일마다 자동으로 떠요. 하루짜리 일정은 날짜를 골라 넣어요.
        </p>
      </div>

      {needsMigration && (
        <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4">
          <p className="text-[13px] text-destructive leading-[19px]">
            스케줄 테이블이 아직 없어요. Supabase SQL Editor에서 <strong>migration_09_schedules.sql</strong>을 실행해주세요.
          </p>
        </div>
      )}

      {children.length === 0 ? (
        <p className="text-foreground-muted text-[14px]">등록된 자녀가 없어요.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {children.map((c) => (
              <button
                key={c.member_id}
                type="button"
                onClick={() => {
                  setSelectedChild(c.member_id)
                  setDraft((prev) => ({ ...prev, memberId: c.member_id }))
                }}
                className={`rounded-full px-4 py-2 font-display font-bold text-[14px] border transition duration-150 ${
                  selectedChild === c.member_id
                    ? 'bg-secondary-dark text-on-secondary border-foreground'
                    : 'bg-surface text-foreground-muted border-border'
                }`}
                aria-pressed={selectedChild === c.member_id}
              >
                {c.name}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="bg-surface border-2 border-foreground rounded-md shadow-sticker p-4 mb-6 flex flex-col gap-3">
            <p className="font-display font-bold text-[15px]">{editingId ? '일정 수정' : '새 일정 추가'}</p>

            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="일정 이름 — 예: 피아노 학원"
              maxLength={60}
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
              autoComplete="off"
            />

            {/* 반복인지 하루인지 — 어느 쪽인지에 따라 아래 입력이 통째로 바뀐다 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'weekly', label: '매주 반복', icon: 'ph-repeat' },
                { key: 'once', label: '하루만', icon: 'ph-calendar-dot' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDraft({ ...draft, repeatType: opt.key })}
                  className={`rounded-md py-2.5 font-display font-bold text-[14px] border flex items-center justify-center gap-1.5 transition duration-150 ${
                    draft.repeatType === opt.key
                      ? 'bg-secondary-dark text-on-secondary border-foreground'
                      : 'bg-surface-muted text-foreground-muted border-border'
                  }`}
                  aria-pressed={draft.repeatType === opt.key}
                >
                  <i className={`ph-bold ${opt.icon} text-base`} aria-hidden="true"></i>
                  {opt.label}
                </button>
              ))}
            </div>

            {draft.repeatType === 'weekly' ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-7 gap-1">
                  {DAY_ORDER.map((day) => {
                    const on = draft.days.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            days: on ? draft.days.filter((d) => d !== day) : [...draft.days, day],
                          })
                        }
                        className={`rounded-md py-2 font-display font-bold text-[14px] border transition duration-150 ${
                          on
                            ? 'bg-primary text-on-primary border-foreground'
                            : 'bg-surface-muted text-foreground-muted border-border'
                        }`}
                        aria-pressed={on}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DAY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, days: preset.days })}
                      className="bg-surface border border-border rounded-full px-3 py-1 text-[12px] font-display font-bold active:scale-95 transition duration-150"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <span className="text-[12px] text-foreground-muted ml-auto">
                    {draft.days.length
                      ? `매주 ${DAY_ORDER.filter((d) => draft.days.includes(d)).join('·')}`
                      : '요일을 골라주세요'}
                  </span>
                </div>
                {editingId && draft.days.length > 1 && (
                  <p className="text-[12px] text-foreground-muted">
                    요일을 늘리면 늘린 요일에 같은 일정이 새로 추가돼요. 지울 때는 요일별로 지워요.
                  </p>
                )}
              </div>
            ) : (
              <input
                type="date"
                value={draft.scheduleDate}
                onChange={(e) => setDraft({ ...draft, scheduleDate: e.target.value })}
                className="bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">시작 시간</p>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                  className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
                />
              </div>
              <div>
                <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">알림</p>
                <select
                  value={draft.alarmMinutes}
                  onChange={(e) => setDraft({ ...draft, alarmMinutes: e.target.value })}
                  className="w-full bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none"
                >
                  {ALARM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {wantsAlarm && notifyState !== 'granted' && (
              <div className="bg-surface-muted rounded-md px-3 py-2.5">
                <p className="text-[12px] text-foreground-muted leading-[18px] mb-2">
                  {notifyState === 'unsupported'
                    ? '이 브라우저는 알림을 지원하지 않아요. 일정은 저장되지만 알림은 울리지 않아요.'
                    : notifyState === 'denied'
                      ? '브라우저에서 알림이 차단되어 있어요. 주소창 옆 자물쇠에서 허용으로 바꿔주세요.'
                      : '알림을 받으려면 브라우저 권한이 필요해요.'}
                </p>
                {notifyState === 'default' && (
                  <button
                    type="button"
                    onClick={askNotification}
                    className="text-[13px] font-display font-bold text-primary active:scale-95 transition duration-150"
                  >
                    알림 켜기
                  </button>
                )}
              </div>
            )}

            {errorMsg && <p className="text-[13px] text-destructive">{errorMsg}</p>}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-secondary-dark text-on-secondary rounded-md py-3 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
              >
                {busy ? '저장하는 중...' : editingId ? '수정하기' : '추가하기'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 text-foreground-muted font-display font-bold text-[14px] active:scale-95 transition duration-150"
                >
                  취소
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <p className="text-foreground-muted text-[14px]">불러오는 중...</p>
          ) : (
            <>
              <h2 className="font-display font-extrabold text-[17px] mb-3">매주 반복</h2>
              <div className="flex flex-col gap-2 mb-6">
                {weekly.map(({ day, items }) => (
                  <div key={day} className="flex items-start gap-3 bg-surface border border-border rounded-md px-3 py-2.5">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-[14px] shrink-0 ${
                        day === todayKey() ? 'bg-primary text-on-primary' : 'bg-surface-muted text-foreground-muted'
                      }`}
                    >
                      {day}
                    </span>
                    {items.length === 0 ? (
                      <span className="text-[13px] text-foreground-muted self-center">일정 없음</span>
                    ) : (
                      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
                        {items.map((s) => (
                          <li key={s.schedule_id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0">
                              <span className="font-display font-bold text-[14px]">{s.title}</span>
                              <span className="block text-[12px] text-foreground-muted">
                                {formatTime(s.start_time)} · {alarmLabel(s.alarm_minutes)}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEdit(s)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                                aria-label={`${s.title} 수정`}
                              >
                                <i className="ph-bold ph-pencil-simple text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(s)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                                aria-label={`${s.title} 삭제`}
                              >
                                <i className="ph-bold ph-trash text-sm"></i>
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <h2 className="font-display font-extrabold text-[17px] mb-3">하루만</h2>
              {onceItems.length === 0 ? (
                <p className="text-foreground-muted text-[14px] mb-4">하루짜리 일정이 없어요.</p>
              ) : (
                <ul className="flex flex-col gap-2 mb-4">
                  {onceItems.map((s) => (
                    <li key={s.schedule_id} className="flex items-center justify-between gap-2 bg-surface border border-border rounded-md px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="font-display font-bold text-[14px]">{s.title}</span>
                        <span className="block text-[12px] text-foreground-muted">
                          {s.schedule_date} · {formatTime(s.start_time)} · {alarmLabel(s.alarm_minutes)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                          aria-label={`${s.title} 수정`}
                        >
                          <i className="ph-bold ph-pencil-simple text-sm"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(s)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                          aria-label={`${s.title} 삭제`}
                        >
                          <i className="ph-bold ph-trash text-sm"></i>
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <div className="flex-1"></div>
    </>
  )
}

export default ChildScheduleScreen
