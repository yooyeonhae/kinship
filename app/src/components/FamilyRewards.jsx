import { useCallback, useEffect, useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import { isMissingTable } from '../lib/familyRoom'

// memberId가 비어 있으면 가족 공동 목표(가족 포인트로), 값이 있으면 그 아이의
// 별로 이루는 개인 목표다. 아이가 스스로 만든 할일은 가족 포인트를 주지 않으므로
// (migration_18), 아이의 동기는 이 별 목표로 이어진다.
const EMPTY = { title: '', requiredPoints: '', note: '', memberId: '' }

function formatPoints(n) {
  return n.toLocaleString('ko-KR')
}

function FamilyRewards({ points }) {
  const { supabase, familyId, members, isParentAuthed } = useFamily()
  const children = members.filter((m) => m.role === 'child')

  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  // 아이별 별 개수. 완료 상태인 할일을 세는 것이라 체크를 풀면 함께 줄어든다.
  const [starsByMember, setStarsByMember] = useState({})

  const load = useCallback(async () => {
    if (!familyId) return
    const { data, error } = await supabase.from('rewards').select('*').order('required_points')
    if (error) {
      if (isMissingTable(error)) setNeedsMigration(true)
      else setErrorMsg('보상 목표를 불러오지 못했어요.')
      setLoading(false)
      return
    }
    setErrorMsg('')
    setRewards(data || [])
    setLoading(false)
  }, [supabase, familyId])

  const loadStars = useCallback(async () => {
    if (!familyId) return
    const { data, error } = await supabase
      .from('todos')
      .select('assignee_member_id, approved_by')
      .eq('is_done', true)
    if (error) return
    const tally = {}
    for (const row of data || []) {
      if (!row.assignee_member_id) continue
      // 부모가 승인한 할일만 별로 센다. 아이가 체크만 한 것은 아직 0이다.
      if (!row.approved_by) continue
      tally[row.assignee_member_id] = (tally[row.assignee_member_id] || 0) + 1
    }
    setStarsByMember(tally)
  }, [supabase, familyId])

  useEffect(() => {
    load()
    loadStars()
  }, [load, loadStars])

  // 아이가 할일을 체크하면 별이 바뀐다. 할일 화면이 쏘는 신호를 같이 듣는다.
  useEffect(() => {
    window.addEventListener('kinship:points', loadStars)
    window.addEventListener('kinship:change', loadStars)
    return () => {
      window.removeEventListener('kinship:points', loadStars)
      window.removeEventListener('kinship:change', loadStars)
    }
  }, [loadStars])

  const pending = rewards.filter((r) => !r.redeemed_at && !r.member_id)
  const done = rewards.filter((r) => r.redeemed_at && !r.member_id)
  // 다음 목표 = 아직 못 받은 것 중 가장 가까운 것
  const next = pending.find((r) => (points ?? 0) < r.required_points) || null
  const reached = pending.filter((r) => (points ?? 0) >= r.required_points)
  const childGoals = rewards.filter((r) => !r.redeemed_at && r.member_id)

  function startCreate() {
    setEditingId(null)
    setDraft(EMPTY)
    setErrorMsg('')
    setOpen(true)
  }

  function startEdit(reward) {
    setEditingId(reward.reward_id)
    setDraft({
      title: reward.title,
      requiredPoints: String(reward.required_points),
      note: reward.note || '',
      memberId: reward.member_id || '',
    })
    setErrorMsg('')
    setOpen(true)
  }

  async function submit(e) {
    e.preventDefault()
    const title = draft.title.trim()
    const required = Number(draft.requiredPoints)
    if (!title) {
      setErrorMsg('보상 이름을 입력해주세요.')
      return
    }
    if (!Number.isInteger(required) || required < 1) {
      setErrorMsg(draft.memberId ? '필요한 별 개수를 1 이상으로 적어주세요.' : '목표 포인트를 1 이상의 숫자로 적어주세요.')
      return
    }
    setBusy(true)
    const payload = { title, required_points: required, note: draft.note.trim() || null }
    // 가족 목표일 때는 member_id를 아예 보내지 않는다 — migration_18을 아직
    // 실행하지 않은 상태에서도 지금까지 쓰던 가족 목표는 그대로 저장돼야 한다.
    if (draft.memberId || editingId) payload.member_id = draft.memberId || null
    const query = editingId
      ? supabase.from('rewards').update(payload).eq('reward_id', editingId)
      : supabase.from('rewards').insert({ ...payload, family_id: familyId })
    const { error } = await query
    setBusy(false)
    if (error) {
      setErrorMsg(
        error.code === '42501'
          ? '보상 목표는 부모만 정할 수 있어요.'
          : /does not exist|schema cache/i.test(error.message || '')
            ? '아이 별 목표는 migration_18_todo_due_and_stars.sql을 실행한 뒤에 쓸 수 있어요.'
            : '저장하지 못했어요.'
      )
      return
    }
    setOpen(false)
    setDraft(EMPTY)
    setEditingId(null)
    load()
  }

  async function redeem(reward) {
    const { error } = await supabase
      .from('rewards')
      .update({ redeemed_at: new Date().toISOString() })
      .eq('reward_id', reward.reward_id)
    if (error) {
      setErrorMsg('달성 처리를 하지 못했어요.')
      return
    }
    load()
  }

  async function remove(reward) {
    const { error } = await supabase.from('rewards').delete().eq('reward_id', reward.reward_id)
    if (error) {
      setErrorMsg('삭제하지 못했어요.')
      return
    }
    load()
  }

  if (needsMigration) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4">
        <p className="text-[13px] text-destructive leading-[19px]">
          보상 목표 테이블이 아직 없어요. Supabase SQL Editor에서 <strong>migration_08_rewards.sql</strong>을 실행해주세요.
        </p>
      </div>
    )
  }

  return (
    <section className="bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-bold text-[15px] flex items-center gap-2">
          <i className="ph-duotone ph-gift text-xl text-accent"></i>가족 보상 목표
        </p>
        {isParentAuthed && !open && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 text-[12px] font-display font-bold text-primary active:scale-95 transition duration-150"
          >
            <i className="ph-bold ph-plus text-xs"></i>목표 추가
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-foreground-muted text-[13px]">불러오는 중...</p>
      ) : (
        <>
          {next ? (
            <div className="mb-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-display font-bold text-[14px]">다음 목표 · {next.title}</span>
                <span className="text-[12px] text-foreground-muted">
                  {formatPoints(points ?? 0)} / {formatPoints(next.required_points)}p
                </span>
              </div>
              <div className="h-3 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round(((points ?? 0) / next.required_points) * 100))}%` }}
                ></div>
              </div>
              <p className="text-[12px] text-foreground-muted mt-1">
                {formatPoints(Math.max(0, next.required_points - (points ?? 0)))}p 더 모으면 돼요
                {next.note ? ` · ${next.note}` : ''}
              </p>
            </div>
          ) : pending.length === 0 ? (
            <p className="text-foreground-muted text-[13px] leading-[19px]">
              아직 정한 보상이 없어요. 가족이 함께 정한 목표를 넣어보세요. 예) 1만 포인트 외식, 10만 포인트 여행.
            </p>
          ) : null}

          {reached.length > 0 && (
            <div className="bg-tape-yellow/40 rounded-md px-3 py-2.5 mb-3">
              <p className="font-display font-bold text-[13px] mb-1">달성했어요!</p>
              <ul className="flex flex-col gap-1.5">
                {reached.map((r) => (
                  <li key={r.reward_id} className="flex items-center justify-between gap-2">
                    <span className="text-[13px]">
                      {r.title} · {formatPoints(r.required_points)}p
                    </span>
                    {isParentAuthed && (
                      <button
                        type="button"
                        onClick={() => redeem(r)}
                        className="text-[12px] font-display font-bold text-secondary-dark shrink-0 active:scale-95 transition duration-150"
                      >
                        받았어요
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {pending.map((r) => (
                <li key={r.reward_id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className={(points ?? 0) >= r.required_points ? 'text-foreground-muted line-through' : ''}>
                    {r.title} · {formatPoints(r.required_points)}p
                  </span>
                  {isParentAuthed && (
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                        aria-label={`${r.title} 수정`}
                      >
                        <i className="ph-bold ph-pencil-simple text-sm"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                        aria-label={`${r.title} 삭제`}
                      >
                        <i className="ph-bold ph-trash text-sm"></i>
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* 아이의 별 목표. 아이 화면에도 같은 값이 보이고, '받았어요'는 부모만
              누른다 — 아이가 스스로 소진 처리하면 협의가 아니라 선언이 된다. */}
          {childGoals.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-border">
              <p className="font-display font-bold text-[13px] mb-2 flex items-center gap-1.5">
                <i className="ph-fill ph-star text-base text-tape-yellow"></i>아이 별 목표
              </p>
              <ul className="flex flex-col gap-2">
                {childGoals.map((r) => {
                  const owned = starsByMember[r.member_id] || 0
                  const name = members.find((m) => m.member_id === r.member_id)?.name || '아이'
                  const pct = Math.min(100, Math.round((owned / r.required_points) * 100))
                  return (
                    <li key={r.reward_id}>
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate">
                          {name} · {r.title}
                        </span>
                        <span className="shrink-0 flex items-center gap-1">
                          <span className="text-[12px] text-foreground-muted">
                            별 {Math.min(owned, r.required_points)}/{r.required_points}
                          </span>
                          {isParentAuthed && (
                            <>
                              {owned >= r.required_points && (
                                <button
                                  type="button"
                                  onClick={() => redeem(r)}
                                  className="text-[12px] font-display font-bold text-secondary-dark active:scale-95 transition duration-150"
                                >
                                  줬어요
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                                aria-label={`${r.title} 수정`}
                              >
                                <i className="ph-bold ph-pencil-simple text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(r)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted active:scale-90 transition duration-150"
                                aria-label={`${r.title} 삭제`}
                              >
                                <i className="ph-bold ph-trash text-sm"></i>
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-tape-yellow rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {done.length > 0 && (
            <p className="text-[12px] text-foreground-muted mt-3 pt-2 border-t border-dashed border-border">
              지난 보상: {done.map((r) => r.title).join(', ')}
            </p>
          )}
        </>
      )}

      {open && (
        <form onSubmit={submit} className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={draft.memberId ? '보상 이름 — 예: 아이스크림' : '보상 이름 — 예: 가족 외식'}
            maxLength={60}
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
          />
          {/* 누구의 목표인가. 가족 목표는 가족 포인트로, 아이 목표는 그 아이가
              모은 별로 이룬다 — 단위가 달라서 아래 입력의 안내도 함께 바뀐다. */}
          {children.length > 0 && (
            <select
              value={draft.memberId}
              onChange={(e) => setDraft({ ...draft, memberId: e.target.value })}
              className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none"
            >
              <option value="">가족 공동 목표 (가족 포인트)</option>
              {children.map((c) => (
                <option key={c.member_id} value={c.member_id}>
                  {c.name}의 별 목표
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.requiredPoints}
            onChange={(e) => setDraft({ ...draft, requiredPoints: e.target.value })}
            placeholder={draft.memberId ? '필요한 별 개수 — 예: 10' : '목표 포인트 — 예: 10000'}
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
          />
          <input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="메모 (선택) — 예: 아이들이 고른 식당으로"
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
          />
          {errorMsg && <p className="text-[12px] text-destructive">{errorMsg}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-secondary-dark text-on-secondary rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
            >
              {busy ? '저장하는 중...' : editingId ? '수정하기' : '추가하기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setEditingId(null)
                setErrorMsg('')
              }}
              className="px-4 py-2.5 text-foreground-muted font-display font-bold text-[14px] active:scale-95 transition duration-150"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {errorMsg && !open && <p className="text-[12px] text-destructive mt-2">{errorMsg}</p>}
    </section>
  )
}

export default FamilyRewards
