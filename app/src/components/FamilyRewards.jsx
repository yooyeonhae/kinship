import { useCallback, useEffect, useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import { isMissingTable } from '../lib/familyRoom'

const EMPTY = { title: '', requiredPoints: '', note: '' }

function formatPoints(n) {
  return n.toLocaleString('ko-KR')
}

function FamilyRewards({ points }) {
  const { supabase, familyId, isParentAuthed } = useFamily()

  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    load()
  }, [load])

  const pending = rewards.filter((r) => !r.redeemed_at)
  const done = rewards.filter((r) => r.redeemed_at)
  // 다음 목표 = 아직 못 받은 것 중 가장 가까운 것
  const next = pending.find((r) => (points ?? 0) < r.required_points) || null
  const reached = pending.filter((r) => (points ?? 0) >= r.required_points)

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
      setErrorMsg('목표 포인트를 1 이상의 숫자로 적어주세요.')
      return
    }
    setBusy(true)
    const payload = { title, required_points: required, note: draft.note.trim() || null }
    const query = editingId
      ? supabase.from('rewards').update(payload).eq('reward_id', editingId)
      : supabase.from('rewards').insert({ ...payload, family_id: familyId })
    const { error } = await query
    setBusy(false)
    if (error) {
      setErrorMsg(error.code === '42501' ? '보상 목표는 부모만 정할 수 있어요.' : '저장하지 못했어요.')
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
            placeholder="보상 이름 — 예: 가족 외식"
            maxLength={60}
            className="bg-surface-muted rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.requiredPoints}
            onChange={(e) => setDraft({ ...draft, requiredPoints: e.target.value })}
            placeholder="목표 포인트 — 예: 10000"
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
