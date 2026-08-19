import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

const TAB_GUIDE = [
  {
    emoji: '🏠',
    label: '홈',
    who: '모두',
    desc: '지금 앱을 쓸 사람을 고르는 곳이에요. 자녀를 고르면 옷차림·할일 화면으로, 부모를 고르면 PIN을 거쳐 관리 화면으로 이어져요.',
  },
  {
    emoji: '✅',
    label: '할일',
    who: '부모는 등록 · 자녀는 완료',
    desc: '부모가 가족 할일을 원탭으로 등록하면 담당 자녀 화면에 바로 뜨고, 자녀는 자기 할일만 체크할 수 있어요.',
  },
  {
    emoji: '📰',
    label: '정보',
    who: '모두',
    desc: '오늘의 날씨와 생활 소식을 모아 봐요. 아침에 따로 검색하지 않아도 되도록 한 화면에 정리했어요.',
  },
  {
    emoji: '🎈',
    label: '주말',
    who: '모두',
    desc: '지역별 축제와 가볼 만한 곳을 한국관광공사 정보로 실시간으로 보여줘요.',
  },
  {
    emoji: '⛺',
    label: '아지트',
    who: '모두',
    desc: '가족끼리 이야기 나누고 간단한 turn제 게임을 즐기는 공간이에요.',
  },
]

const JOIN_ERROR = {
  format: '가족 코드 형식이 올바르지 않아요. 36자리 코드를 그대로 붙여넣어 주세요.',
  not_found: '그 코드의 가족을 찾지 못했어요. 코드를 다시 확인해주세요.',
  network: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요.',
}

function TabGuide() {
  return (
    <div className="mt-10 pt-8 border-t border-border">
      <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1">앱 안내</p>
      <h2 className="font-display font-extrabold text-[19px] mb-1">우리가족 올인원은 이렇게 써요</h2>
      <p className="text-foreground-muted text-[13px] leading-[20px] mb-4">
        아래 다섯 개 탭이 화면 맨 아래에 항상 떠 있어요. 가족 구성원마다 볼 수 있는 내용이 조금씩 달라요.
      </p>
      <ul className="flex flex-col gap-2.5">
        {TAB_GUIDE.map((tab) => (
          <li key={tab.label} className="bg-surface border border-border rounded-md px-3.5 py-3 flex gap-3">
            <span className="text-xl leading-none pt-0.5" aria-hidden="true">
              {tab.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-[15px]">
                {tab.label}
                <span className="ml-2 font-body font-normal text-[12px] text-foreground-muted">{tab.who}</span>
              </p>
              <p className="text-foreground-muted text-[13px] leading-[20px] mt-0.5">{tab.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-foreground-muted text-[13px] leading-[20px] mt-4">
        오른쪽 아래 💬 버튼을 누르면 챗봇이 열려요. “오늘 할일 뭐 있어?”, “오늘 18시 도서관 가야 된다”처럼 말하면 돼요.
      </p>
    </div>
  )
}

function OnboardingScreen() {
  const { createFamily, joinFamily } = useFamily()
  const navigate = useNavigate()

  const [mode, setMode] = useState('create')
  const [familyName, setFamilyName] = useState('')
  const [members, setMembers] = useState([])
  const [draftName, setDraftName] = useState('')
  const [draftRole, setDraftRole] = useState('child')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [joinCode, setJoinCode] = useState('')
  // 만들어진 가족 코드를 보여주기 전에 화면을 넘기면, 다음 기기에서 이어 쓸 방법이 사라진다.
  const [createdId, setCreatedId] = useState(null)
  const [copied, setCopied] = useState(false)

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
      const id = await createFamily(name, members)
      setCreatedId(id)
    } catch {
      setError('가족을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const res = await joinFamily(joinCode)
    setSubmitting(false)
    if (!res.ok) {
      setError(JOIN_ERROR[res.error] || JOIN_ERROR.network)
      return
    }
    navigate('/', { replace: true })
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(createdId)
      setCopied(true)
    } catch {
      // 클립보드가 막힌 환경(비 HTTPS 등)에서는 화면의 코드를 직접 옮겨 적으면 된다
      setCopied(false)
    }
  }

  if (createdId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <span className="inline-block w-3 h-3 rounded-full bg-accent mb-3" aria-hidden="true"></span>
          <h1 className="font-display font-extrabold text-display">가족이 만들어졌어요</h1>
          <p className="text-foreground-muted text-body mt-2">
            아래 <strong>가족 코드</strong>를 적어두세요. 다른 기기나 브라우저에서 이 코드를 넣으면 구성원을 다시 입력하지
            않고 그대로 이어서 쓸 수 있어요.
          </p>

          <div className="mt-5 bg-surface border border-border rounded-md px-4 py-3.5">
            <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-1.5">가족 코드</p>
            <p className="font-mono text-[13px] break-all leading-[20px]">{createdId}</p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-3 text-[13px] font-display font-bold text-primary active:scale-95 transition duration-150"
            >
              {copied ? '복사했어요' : '코드 복사하기'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-6 w-full bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
          >
            시작하기
            <i className="ph-bold ph-arrow-right text-lg"></i>
          </button>

          <TabGuide />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <span className="inline-block w-3 h-3 rounded-full bg-accent mb-3" aria-hidden="true"></span>
          <h1 className="font-display font-extrabold text-display">우리 가족을 알려주세요</h1>
          <p className="text-foreground-muted text-body mt-2">
            처음이라면 가족을 새로 만들고, 이미 만든 가족이 있다면 가족 코드로 이어서 쓸 수 있어요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { key: 'create', label: '새로 만들기' },
            { key: 'join', label: '가족 코드로 참여' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setMode(tab.key)
                setError('')
              }}
              className={`rounded-md py-2.5 font-display font-bold text-[14px] border transition duration-150 ${
                mode === tab.key
                  ? 'bg-secondary-dark text-on-secondary border-foreground'
                  : 'bg-surface text-foreground-muted border-border'
              }`}
              aria-pressed={mode === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'join' ? (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-2">가족 코드</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="예: 3f9c1a2b-…"
                className="w-full bg-surface rounded-md px-4 py-3 text-[14px] font-mono border border-border outline-none"
                autoComplete="off"
                spellCheck="false"
              />
              <p className="text-foreground-muted text-[12px] mt-2 leading-[18px]">
                가족을 처음 만들 때 안내된 36자리 코드예요. 같은 가족의 다른 기기에서 확인할 수 있어요.
              </p>
            </div>

            {error && <p className="text-[13px] text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
            >
              {submitting ? '확인하는 중...' : '이어서 쓰기'}
              <i className="ph-bold ph-arrow-right text-lg"></i>
            </button>
          </form>
        ) : (
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
                        {m.name}{' '}
                        <span className="text-foreground-muted font-body font-normal text-[13px]">
                          · {m.role === 'parent' ? '부모' : '자녀'}
                        </span>
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
        )}

        <TabGuide />
      </div>
    </div>
  )
}

export default OnboardingScreen
