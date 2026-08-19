import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { characterOf } from '../lib/avatars'

function formatLockedUntil(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  const m = d.getMinutes()
  return `${period} ${h12}:${m < 10 ? '0' : ''}${m}`
}

function PinInput({ value, onChange, label, autoFocus }) {
  return (
    <label className="block">
      <span className="font-display font-bold text-label tracking-wide text-foreground-muted">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="mt-1 w-full bg-surface rounded-md px-4 py-3 text-[22px] tracking-[0.5em] text-center border border-border outline-none"
        placeholder="••••"
      />
    </label>
  )
}

function ParentUnlockScreen() {
  const { memberId } = useParams()
  const { members, parentLogin, setParentPin, setCurrentMember } = useFamily()
  const navigate = useNavigate()

  const parent = members.find((m) => m.member_id === memberId && m.role === 'parent')

  // 'enter'  — PIN 입력
  // 'create' — 아직 PIN이 없는 부모의 최초 설정
  const [mode, setMode] = useState('enter')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [locked, setLocked] = useState(null)

  if (!parent) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-foreground-muted text-body">부모를 찾을 수 없어요.</p>
          <Link to="/" className="mt-4 inline-block font-display font-bold text-primary">
            처음으로
          </Link>
        </div>
      </div>
    )
  }

  function finish() {
    setCurrentMember(parent.member_id)
    navigate('/parent-recipe', { replace: true })
  }

  async function handleEnter(e) {
    e.preventDefault()
    if (pin.length !== 4) return
    setBusy(true)
    setMessage('')
    const res = await parentLogin(parent.member_id, pin)
    setBusy(false)
    setPin('')

    if (res?.ok) return finish()

    if (res?.error === 'pin_not_set') {
      setMode('create')
      setMessage('아직 PIN이 없어요. 새로 만들어주세요.')
      return
    }
    if (res?.error === 'locked') {
      setLocked(res.locked_until)
      setMessage(`너무 여러 번 틀렸어요. ${formatLockedUntil(res.locked_until)} 이후에 다시 시도할 수 있어요.`)
      return
    }
    if (res?.error === 'invalid_pin') {
      const left = res.attempts_left
      setMessage(left > 0 ? `PIN이 달라요. ${left}번 더 틀리면 잠겨요.` : 'PIN이 달라요. 이번이 마지막이었어요.')
      return
    }
    setMessage('지금은 확인할 수 없어요. 잠시 뒤 다시 시도해주세요.')
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (pin.length !== 4) return setMessage('PIN은 숫자 4자리예요.')
    if (pin !== pin2) return setMessage('두 번 입력한 PIN이 달라요.')

    setBusy(true)
    setMessage('')
    const res = await setParentPin(parent.member_id, pin)

    if (res?.ok) {
      const login = await parentLogin(parent.member_id, pin)
      setBusy(false)
      if (login?.ok) return finish()
      setMessage('PIN은 만들었는데 로그인에 실패했어요. 다시 입력해주세요.')
      setMode('enter')
      setPin('')
      setPin2('')
      return
    }

    setBusy(false)
    if (res?.error === 'parent_auth_required') {
      setMessage('이미 PIN을 설정한 다른 부모가 있어요. 그 부모가 로그인한 뒤에 설정할 수 있어요.')
      return
    }
    if (res?.error === 'pin_must_be_4_digits') {
      setMessage('PIN은 숫자 4자리예요.')
      return
    }
    setMessage('PIN을 만들지 못했어요. 잠시 뒤 다시 시도해주세요.')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-foreground-muted text-label mb-6">
          <i className="ph-bold ph-caret-left text-base" aria-hidden="true"></i>
          처음으로
        </Link>

        <div className="mb-8">
          {/* 로그인 화면에 자물쇠만 있으면 누구로 들어가는 중인지 이름을 읽어야 안다.
              캐릭터를 크게 놓으면 그 자리가 누구 자리인지 바로 보인다. */}
          <span className="w-16 h-16 rounded-full bg-pastel-mint border-2 border-foreground shadow-sticker flex items-center justify-center text-[32px]" aria-hidden="true">
            {characterOf(parent)}
          </span>
          <h1 className="font-display font-extrabold text-heading mt-3">
            {mode === 'create' ? `${parent.name}의 PIN 만들기` : `${parent.name}, PIN을 입력해주세요`}
          </h1>
          <p className="text-foreground-muted text-body mt-2">
            {mode === 'create'
              ? '아이가 부모 화면을 실수로 바꾸지 않도록, 숫자 4자리 PIN을 정해주세요.'
              : '부모 화면에 들어가려면 PIN이 필요해요.'}
          </p>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <PinInput label="새 PIN (숫자 4자리)" value={pin} onChange={setPin} autoFocus />
            <PinInput label="한 번 더" value={pin2} onChange={setPin2} />
            {message && <p className="text-[13px] text-destructive">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
            >
              {busy ? '만드는 중...' : 'PIN 만들고 시작하기'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEnter} className="flex flex-col gap-4">
            <PinInput label="PIN" value={pin} onChange={setPin} autoFocus />
            {message && <p className={`text-[13px] ${locked ? 'text-destructive' : 'text-accent'}`}>{message}</p>}
            <button
              type="submit"
              disabled={busy || !!locked}
              className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
            >
              {busy ? '확인 중...' : '들어가기'}
              <i className="ph-bold ph-arrow-right text-lg" aria-hidden="true"></i>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default ParentUnlockScreen
