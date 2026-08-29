import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { characterOf } from '../lib/avatars'
import FamilyInvite from './FamilyInvite'
import FamilySettings from './FamilySettings'
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push'

// 우측 상단 메뉴. 여기 모으기 전에는 설정 성격의 것들이 화면마다 흩어져 있었다 —
// 알림 켜기는 아지트 안에, 부모 모드 끝내기는 부모 할일 화면 맨 아래에, 초대는 홈에만.
// 어디서든 같은 자리에서 열리는 것이 "설정"이 있어야 할 자리다.
//
// 부모 전용 화면(스케줄·지정복·레시피)은 하단 탭에 없어서 부모 할일 화면을 거쳐야만
// 갈 수 있었다. 그 길도 여기로 낸다.
function TopMenu() {
  const navigate = useNavigate()
  const {
    familyId,
    familyName,
    members,
    currentMember,
    currentMemberId,
    isParentRole,
    isParentAuthed,
    parentLogout,
    resetFamily,
  } = useFamily()

  const [open, setOpen] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    currentSubscription().then((sub) => setPushOn(Boolean(sub)))
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    setConfirmLeave(false)
    setShowSettings(false)
    setPushMsg('')
  }, [])

  // 열려 있는 동안만 바깥 클릭과 Esc를 듣는다. 항상 듣고 있으면 다른 화면의
  // 버튼 한 번 누를 때마다 쓸데없이 콜백이 돈다.
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    function onDown(e) {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, close])

  function go(path) {
    close()
    navigate(path)
  }

  // 아이 화면은 부모가 "다시 보기" 할 일이 잦다 — 오늘 뭘 입혀 보냈는지, 할일을
  // 다 했는지. 홈으로 나가 아이를 고르면 **그 아이로 신원이 바뀌어** 부모 모드가
  // 풀리는데, 여기서 바로 들어가면 부모인 채로 화면만 본다(RequireChildSelf는
  // 부모 역할이면 통과시킨다).
  const children = members.filter((m) => m.role === 'child')
  const visibleChildren = isParentRole ? children : children.filter((m) => m.member_id === currentMemberId)

  const parentLinks = [
    { path: '/parent-tasks', label: '가족 할일 관리', icon: 'ph-check-square-offset' },
    { path: '/child-schedule', label: '아이 스케줄', icon: 'ph-calendar-dots' },
    { path: '/outfit-settings', label: '요일별 지정복', icon: 'ph-t-shirt' },
    { path: '/parent-recipe', label: '오늘의 메뉴', icon: 'ph-cooking-pot' },
    { path: '/parent-progress', label: '부부 완료 현황', icon: 'ph-chart-line-up' },
  ]

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full bg-surface border-2 border-foreground shadow-sticker flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="메뉴 열기"
      >
        <i className={`ph-bold ${open ? 'ph-x' : 'ph-list'} text-lg text-foreground`} aria-hidden="true"></i>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-foreground/10 z-[60]" aria-hidden="true"></div>
          <div
            ref={panelRef}
            className="absolute right-0 top-12 z-[70] w-[19rem] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] overflow-y-auto bg-surface border-2 border-foreground rounded-md shadow-sticker"
            role="menu"
          >
            <div className="px-4 py-3 bg-surface-muted border-b border-border">
              <p className="text-[11px] text-foreground-muted">{familyName || '우리가족'}</p>
              <p className="font-display font-bold text-[15px] flex items-center gap-1.5">
                <span aria-hidden="true">{characterOf(currentMember)}</span>
                {currentMember?.name || '누구인지 고르지 않음'}
                {isParentAuthed && (
                  <span className="text-[10px] font-display font-bold text-secondary border border-secondary rounded-full px-1.5">
                    부모
                  </span>
                )}
              </p>
            </div>

            <div className="py-1">
              <MenuItem icon="ph-users-three" label="다른 사람으로 바꾸기" onClick={() => go('/')} />

              {isParentRole && isParentAuthed && (
                <MenuItem
                  icon="ph-lock-simple"
                  label="부모 모드 끝내기"
                  onClick={async () => {
                    await parentLogout()
                    close()
                    navigate('/', { replace: true })
                  }}
                />
              )}
              {isParentRole && !isParentAuthed && currentMemberId && (
                <MenuItem
                  icon="ph-lock-simple-open"
                  label="부모 모드 켜기 (PIN)"
                  onClick={() => go(`/parent-unlock/${currentMemberId}`)}
                />
              )}
            </div>

            {visibleChildren.length > 0 && (
              <div className="py-1 border-t border-border">
                <p className="px-4 pt-1 pb-1 text-[10px] font-display font-bold tracking-wide text-foreground-muted">
                  아이 화면 보기
                </p>
                {visibleChildren.map((c) => (
                  <div key={c.member_id} className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go(`/child-outfit/${c.member_id}`)}
                      className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-2.5 text-left active:bg-surface-muted transition duration-150"
                    >
                      <span className="text-base shrink-0" aria-hidden="true">
                        {characterOf(c)}
                      </span>
                      <span className="min-w-0">
                        <span className="font-display font-bold text-[14px] block truncate">{c.name}</span>
                        <span className="text-[11px] text-foreground-muted">오늘 날씨 · 지정복</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go(`/child-todo/${c.member_id}`)}
                      className="shrink-0 bg-surface-muted border border-border rounded-full px-2.5 py-1 text-[11px] font-display font-bold active:scale-95 transition duration-150"
                    >
                      할일
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isParentAuthed && (
              <div className="py-1 border-t border-border">
                <p className="px-4 pt-1 pb-1 text-[10px] font-display font-bold tracking-wide text-foreground-muted">
                  부모 전용
                </p>
                {parentLinks.map((l) => (
                  <MenuItem key={l.path} icon={l.icon} label={l.label} onClick={() => go(l.path)} />
                ))}
              </div>
            )}

            <div className="py-1 border-t border-border">
              {pushSupported() && currentMemberId && (
                <PushRow
                  familyId={familyId}
                  memberId={currentMemberId}
                  pushOn={pushOn}
                  setPushOn={setPushOn}
                  busy={pushBusy}
                  setBusy={setPushBusy}
                  setMsg={setPushMsg}
                />
              )}
              {pushMsg && <p className="px-4 pb-2 text-[12px] text-destructive leading-[17px]">{pushMsg}</p>}
            </div>

            <div className="border-t border-border">
              <MenuItem
                icon="ph-sliders-horizontal"
                label={showSettings ? '설정 닫기' : '설정'}
                onClick={() => setShowSettings((v) => !v)}
              />
              {showSettings && (
                <div className="px-4 pb-3">
                  <FamilySettings onDone={() => setShowSettings(false)} />
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <p className="text-[10px] font-display font-bold tracking-wide text-foreground-muted mb-2">
                가족 초대
              </p>
              <FamilyInvite familyId={familyId} compact />
            </div>

            <div className="px-4 py-3 border-t border-border bg-surface-muted">
              {confirmLeave ? (
                <>
                  <p className="text-[12px] text-foreground mb-2 leading-[17px]">
                    이 기기에서만 가족 연결을 끊어요. 가족 데이터는 지워지지 않고, 초대 코드로 다시 들어올 수 있어요.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetFamily()
                        close()
                        navigate('/onboarding', { replace: true })
                      }}
                      className="flex-1 bg-destructive text-on-destructive rounded-md py-2 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150"
                    >
                      연결 끊기
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="flex-1 bg-surface border border-border rounded-md py-2 font-display font-bold text-[13px] active:scale-[0.97] transition duration-150"
                    >
                      그만두기
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="text-[12px] text-foreground-muted active:scale-95 transition duration-150"
                >
                  이 기기에서 가족 연결 끊기
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left active:bg-surface-muted transition duration-150"
    >
      <i className={`ph-bold ${icon} text-base text-foreground-muted shrink-0`} aria-hidden="true"></i>
      <span className="font-display font-bold text-[14px]">{label}</span>
    </button>
  )
}

// 푸시 구독은 supabase 클라이언트가 필요해서 여기서만 useFamily를 다시 쓴다.
function PushRow({ familyId, memberId, pushOn, setPushOn, busy, setBusy, setMsg }) {
  const { supabase } = useFamily()

  async function toggle() {
    if (busy) return
    setBusy(true)
    setMsg('')
    if (pushOn) {
      await disablePush(supabase)
      setPushOn(false)
      setBusy(false)
      return
    }
    const res = await enablePush(supabase, { familyId, memberId })
    setBusy(false)
    if (res.ok) {
      setPushOn(true)
      return
    }
    if (res.error === 'unsupported') setMsg('이 브라우저는 휴대폰 알림을 지원하지 않아요.')
    else if (res.error === 'denied') setMsg('브라우저에서 알림이 차단되어 있어요. 주소창 옆 자물쇠에서 허용으로 바꿔주세요.')
    else if (res.error === 'no_key') setMsg('서버에 푸시 키가 설정되지 않았어요.')
    else if (res.error === 'save_failed') setMsg('알림 등록을 저장하지 못했어요. migration_14를 확인해주세요.')
    else setMsg('알림을 켜지 못했어요.')
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={toggle}
      disabled={busy}
      className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left active:bg-surface-muted transition duration-150 disabled:opacity-60"
      aria-pressed={pushOn}
    >
      <i
        className={`ph-bold ${pushOn ? 'ph-bell-ringing' : 'ph-bell-slash'} text-base shrink-0 ${pushOn ? 'text-secondary' : 'text-foreground-muted'}`}
        aria-hidden="true"
      ></i>
      <span className="font-display font-bold text-[14px] flex-1">가족톡 휴대폰 알림</span>
      <span
        className={`text-[11px] font-display font-bold rounded-full px-2 py-0.5 border shrink-0 ${
          pushOn ? 'bg-secondary-dark text-on-secondary border-foreground' : 'bg-surface-muted text-foreground-muted border-border'
        }`}
      >
        {busy ? '...' : pushOn ? '켜짐' : '꺼짐'}
      </span>
    </button>
  )
}

export default TopMenu
