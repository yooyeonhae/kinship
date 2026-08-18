import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

function OnboardingScreen() {
  const { createFamily } = useFamily()
  const navigate = useNavigate()

  const [familyName, setFamilyName] = useState('')
  const [members, setMembers] = useState([])
  const [draftName, setDraftName] = useState('')
  const [draftRole, setDraftRole] = useState('child')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function addMember() {
    const name = draftName.trim()
    if (!name) return
    setMembers((prev) => [...prev, { name, role: draftRole }])
    setDraftName('')
  }

  function removeMember(idx) {
    setMembers((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const name = familyName.trim()
    if (!name || members.length === 0) {
      setError('가족 이름과 구성원을 한 명 이상 입력해주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await createFamily(name, members)
      navigate('/', { replace: true })
    } catch {
      setError('가족을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="inline-block w-3 h-3 rounded-full bg-accent mb-3" aria-hidden="true"></span>
          <h1 className="font-display font-extrabold text-display">우리 가족을 알려주세요</h1>
          <p className="text-foreground-muted text-body mt-2">가족 이름과 구성원을 등록하면 바로 시작할 수 있어요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-2">가족 이름</p>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="예: 우리집"
              className="w-full bg-surface rounded-md px-4 py-3 text-[15px] border border-border outline-none"
              autoComplete="off"
            />
          </div>

          <div>
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-2">구성원</p>
            {members.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {members.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-surface-muted rounded-md px-3 py-2">
                    <span className="font-display font-bold text-[14px]">
                      {m.name} <span className="text-foreground-muted font-body font-normal text-[13px]">· {m.role === 'parent' ? '부모' : '자녀'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
                      aria-label={`${m.name} 삭제`}
                    >
                      <i className="ph-bold ph-x text-sm text-foreground-muted"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addMember()
                  }
                }}
                placeholder="이름"
                className="flex-1 bg-surface rounded-md px-3 py-2.5 text-[15px] border border-border outline-none"
                autoComplete="off"
              />
              <select
                value={draftRole}
                onChange={(e) => setDraftRole(e.target.value)}
                className="bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none"
              >
                <option value="child">자녀</option>
                <option value="parent">부모</option>
              </select>
              <button
                type="button"
                onClick={addMember}
                className="w-11 h-11 rounded-full bg-secondary-dark text-on-secondary flex items-center justify-center shrink-0 active:scale-90 transition duration-150"
                aria-label="구성원 추가"
              >
                <i className="ph-bold ph-plus text-lg"></i>
              </button>
            </div>
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
          >
            {submitting ? '만드는 중...' : '시작하기'}
            <i className="ph-bold ph-arrow-right text-lg"></i>
          </button>
        </form>
      </div>
    </div>
  )
}

export default OnboardingScreen
