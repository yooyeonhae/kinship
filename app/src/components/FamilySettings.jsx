import { useEffect, useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import {
  DEFAULT_SETTINGS,
  SETTING_FIELDS,
  familyNameMessage,
  loadSettings,
  saveFamilyName,
  saveSettings,
  settingsErrorMessage,
} from '../lib/settings'
import { TOUR_REGIONS } from '../lib/tourapi'

// 코드에 박혀 있던 숫자들을 가족이 정하는 자리. 아이도 값을 볼 수 있게 하고
// (하루 몇 개까지인지 아이가 알아야 한다), 바꾸는 것은 부모만 한다.
function FamilySettings({ onDone }) {
  const { supabase, familyId, familyName, isParentAuthed, reload } = useFamily()

  const [values, setValues] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(false)
  // 가족 이름은 families 표에 있어서 저장 경로가 다르다 — 따로 들고 따로 저장한다.
  const [nameDraft, setNameDraft] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [nameBusy, setNameBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await loadSettings(supabase)
      if (!alive) return
      setValues(res.data)
      if (res.missing) setMsg('아직 기본값으로 돌고 있어요. migration_21을 실행하면 저장할 수 있어요.')
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  function setField(key, raw, field) {
    setSaved(false)
    if (field.kind === 'toggle') {
      setValues((prev) => ({ ...prev, [key]: raw }))
      return
    }
    // 빈 칸을 그대로 두면 저장할 때 NaN이 된다. 지우는 중일 수 있으니 문자열로 들고 있다가
    // 저장 직전에 숫자로 바꾼다.
    setValues((prev) => ({ ...prev, [key]: raw }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return

    const cleaned = { ...values }
    for (const f of SETTING_FIELDS) {
      if (f.kind !== 'number') continue
      const n = Number.parseInt(cleaned[f.key], 10)
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        setMsg(`‘${f.label}’은 ${f.min}~${f.max} 사이로 적어주세요.`)
        return
      }
      cleaned[f.key] = n
    }

    setBusy(true)
    setMsg('')
    const res = await saveSettings(supabase, familyId, cleaned)
    setBusy(false)
    if (res.error) {
      setMsg(settingsErrorMessage(res.error))
      return
    }
    setValues(cleaned)
    setSaved(true)
  }

  async function submitName(e) {
    e.preventDefault()
    if (nameBusy) return
    setNameBusy(true)
    setNameMsg('')
    const res = await saveFamilyName(supabase, familyId, nameDraft)
    setNameBusy(false)
    if (res.error || res.reason) {
      setNameMsg(familyNameMessage(res.reason))
      return
    }
    setNameMsg('바꿨어요.')
    // 헤더에 걸린 가족 이름도 함께 바뀌어야 한다
    reload?.()
  }

  if (loading) return <p className="text-[13px] text-foreground-muted">불러오는 중...</p>

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!isParentAuthed && (
        <p className="text-[12px] text-foreground-muted leading-[17px]">
          지금 값이에요. 바꾸는 것은 부모만 할 수 있어요.
        </p>
      )}

      <div>
        <label htmlFor="set-family-name" className="font-display font-bold text-[13px]">
          가족 이름
        </label>
        <div className="flex items-center gap-1.5 mt-1">
          <input
            id="set-family-name"
            type="text"
            value={nameDraft}
            onChange={(e) => {
              setNameDraft(e.target.value)
              setNameMsg('')
            }}
            placeholder={familyName || '우리가족'}
            maxLength={20}
            disabled={!isParentAuthed}
            className="flex-1 min-w-0 bg-surface-muted rounded-md px-2 py-1 text-[13px] border border-border outline-none focus:border-foreground transition duration-150 disabled:opacity-60"
            autoComplete="off"
          />
          {isParentAuthed && (
            <button
              type="button"
              onClick={submitName}
              disabled={nameBusy || !nameDraft.trim()}
              className="shrink-0 bg-surface-muted border border-border rounded-md px-2.5 py-1 text-[12px] font-display font-bold active:scale-95 transition duration-150 disabled:opacity-50"
            >
              {nameBusy ? '...' : '바꾸기'}
            </button>
          )}
        </div>
        {nameMsg && (
          <p className={`text-[11px] mt-0.5 ${nameMsg === '바꿨어요.' ? 'text-secondary' : 'text-destructive'}`}>
            {nameMsg}
          </p>
        )}
      </div>

      {SETTING_FIELDS.map((f) => (
        <div key={f.key}>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`set-${f.key}`} className="font-display font-bold text-[13px] flex-1">
              {f.label}
            </label>
            {f.kind === 'region' ? (
              <select
                id={`set-${f.key}`}
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value, f)}
                disabled={!isParentAuthed}
                className="shrink-0 bg-surface-muted rounded-md px-2 py-1 text-[13px] border border-border outline-none disabled:opacity-60"
              >
                {TOUR_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : f.kind === 'toggle' ? (
              <button
                id={`set-${f.key}`}
                type="button"
                onClick={() => setField(f.key, !values[f.key], f)}
                disabled={!isParentAuthed}
                aria-pressed={Boolean(values[f.key])}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-display font-bold border transition duration-150 active:scale-95 disabled:opacity-60 ${
                  values[f.key]
                    ? 'bg-secondary-dark text-on-secondary border-foreground'
                    : 'bg-surface-muted text-foreground-muted border-border'
                }`}
              >
                {values[f.key] ? '켜짐' : '꺼짐'}
              </button>
            ) : (
              <span className="shrink-0 flex items-center gap-1">
                <input
                  id={`set-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value, f)}
                  disabled={!isParentAuthed}
                  className="w-16 bg-surface-muted rounded-md px-2 py-1 text-[13px] text-right border border-border outline-none focus:border-foreground transition duration-150 disabled:opacity-60"
                />
                <span className="text-[11px] text-foreground-muted">{f.unit}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-foreground-muted leading-[16px] mt-0.5">{f.help}</p>
        </div>
      ))}

      {msg && <p className="text-[12px] text-destructive leading-[17px]">{msg}</p>}
      {saved && <p className="text-[12px] text-secondary font-display font-bold">저장했어요.</p>}

      {isParentAuthed && (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-primary text-on-primary rounded-md py-2 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 bg-surface-muted border border-border rounded-md py-2 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150"
          >
            닫기
          </button>
        </div>
      )}
    </form>
  )
}

export default FamilySettings
