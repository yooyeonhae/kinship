import { useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import CharacterPicker from './CharacterPicker'
import { characterOf } from '../lib/avatars'

const PALETTE_COLORS = [
  { value: '#3b82f6', label: '파랑' },
  { value: '#10b981', label: '초록' },
  { value: '#f59e0b', label: '주황' },
  { value: '#ec4899', label: '핑크' },
  { value: '#8b5cf6', label: '보라' },
  { value: '#06b6d4', label: '하늘' },
]

export default function FamilyMemberManager({ onClose }) {
  const {
    members,
    currentMember,
    isParentAuthed,
    parentLogin,
    addMember,
    updateMember,
    deleteMember,
  } = useFamily()

  // PIN 인증 상태 (아직 부모 인증되지 않은 경우 사용)
  const parents = members.filter((m) => m.role === 'parent')
  const [selectedParentId, setSelectedParentId] = useState(
    currentMember?.role === 'parent' ? currentMember.member_id : parents[0]?.member_id || ''
  )
  const [pin, setPin] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  // 추가/수정 모드 상태
  // mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState('list')
  const [editingMember, setEditingMember] = useState(null)

  // 폼 입력 상태
  const [name, setName] = useState('')
  const [role, setRole] = useState('child')
  const [avatar, setAvatar] = useState('🐭')
  const [color, setColor] = useState('#3b82f6')
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')

  // 삭제 확인 모달
  const [memberToDelete, setMemberToDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // PIN 로그인 처리
  async function handleParentUnlock(e) {
    e.preventDefault()
    if (authBusy) return
    if (!selectedParentId) {
      setAuthError('부모를 선택해주세요.')
      return
    }
    if (pin.length !== 4) {
      setAuthError('4자리 PIN 번호를 입력해주세요.')
      return
    }

    setAuthBusy(true)
    setAuthError('')
    const res = await parentLogin(selectedParentId, pin)
    setAuthBusy(false)

    if (res.ok) {
      setPin('')
    } else {
      if (res.error === 'invalid_pin') {
        setAuthError(`비밀번호가 맞지 않아요. (${res.attempts_left ?? ''}회 남음)`)
      } else if (res.error === 'locked') {
        setAuthError('비밀번호 시도 횟수를 초과해 잠시 잠겼어요.')
      } else if (res.error === 'pin_not_set') {
        setAuthError('PIN 번호가 설정되지 않았어요.')
      } else {
        setAuthError('인증에 실패했어요. 다시 시도해주세요.')
      }
    }
  }

  // 추가 모드 진입
  function startAdd() {
    setName('')
    setRole('child')
    setAvatar('🐭')
    setColor('#3b82f6')
    setFormError('')
    setEditingMember(null)
    setMode('add')
  }

  // 수정 모드 진입
  function startEdit(member) {
    setName(member.name || '')
    setRole(member.role || 'child')
    setAvatar(characterOf(member))
    setColor(member.color || '#3b82f6')
    setFormError('')
    setEditingMember(member)
    setMode('edit')
  }

  // 추가/수정 제출
  async function handleFormSubmit(e) {
    e.preventDefault()
    if (formBusy) return
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('이름을 입력해주세요.')
      return
    }
    if (trimmed.length > 20) {
      setFormError('이름은 20자 이하로 적어주세요.')
      return
    }

    setFormBusy(true)
    setFormError('')

    let res
    if (mode === 'add') {
      res = await addMember({
        name: trimmed,
        role,
        avatar,
        color,
      })
    } else {
      res = await updateMember(editingMember.member_id, {
        name: trimmed,
        role,
        avatar,
        color,
      })
    }

    setFormBusy(false)
    if (res.ok) {
      setMode('list')
      setEditingMember(null)
    } else {
      if (res.error === 'last_parent_cannot_be_child') {
        setFormError('가족에 부모가 한 명은 꼭 있어야 해요.')
      } else if (res.error === 'parent_only') {
        setFormError('부모 권한이 필요해요. PIN을 다시 확인해주세요.')
      } else {
        setFormError(res.error || '저장에 실패했어요.')
      }
    }
  }

  // 삭제 실행
  async function confirmDelete() {
    if (!memberToDelete || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')

    const res = await deleteMember(memberToDelete.member_id)
    setDeleteBusy(false)

    if (res.ok) {
      setMemberToDelete(null)
      if (mode === 'edit' && editingMember?.member_id === memberToDelete.member_id) {
        setMode('list')
        setEditingMember(null)
      }
    } else {
      if (res.error === 'cannot_delete_last_parent') {
        setDeleteError('마지막 부모는 삭제할 수 없어요.')
      } else {
        setDeleteError(res.error || '삭제하지 못했어요.')
      }
    }
  }

  const parentCount = members.filter((m) => m.role === 'parent').length

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-foreground rounded-lg shadow-sticker max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* 모달 상단 헤더 */}
        <div className="px-5 py-3.5 bg-tape-yellow border-b-2 border-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">👨‍👩‍👧‍👦</span>
            <h2 className="font-display font-bold text-[16px] text-foreground">가족 식구 관리</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface border border-foreground flex items-center justify-center text-foreground hover:bg-surface-muted active:scale-95 transition"
            aria-label="닫기"
          >
            <i className="ph-bold ph-x text-sm" aria-hidden="true"></i>
          </button>
        </div>

        {/* 본문 내용 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* 부모 미인증 시 인라인 PIN 인증 화면 */}
          {!isParentAuthed ? (
            <div className="space-y-4">
              <div className="bg-surface-muted border border-border rounded-md p-4 text-center space-y-2">
                <i className="ph-bold ph-lock-key text-2xl text-secondary" aria-hidden="true"></i>
                <h3 className="font-display font-bold text-[15px] text-foreground">
                  부모 확인이 필요해요
                </h3>
                <p className="text-[12px] text-foreground-muted leading-relaxed">
                  식구를 추가, 수정, 삭제하는 작업은 부모님만 할 수 있어요.
                  <br />
                  부모 선택 후 4자리 PIN 번호를 입력해주세요.
                </p>
              </div>

              <form onSubmit={handleParentUnlock} className="space-y-3">
                {parents.length > 1 && (
                  <div>
                    <label className="block text-[12px] font-display font-bold text-foreground-muted mb-1">
                      부모 선택
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {parents.map((p) => (
                        <button
                          key={p.member_id}
                          type="button"
                          onClick={() => setSelectedParentId(p.member_id)}
                          className={`p-2.5 rounded-md border flex items-center gap-2 text-left transition ${
                            selectedParentId === p.member_id
                              ? 'bg-secondary-dark text-on-secondary border-foreground shadow-sticker font-bold'
                              : 'bg-surface border-border text-foreground hover:bg-surface-muted'
                          }`}
                        >
                          <span className="text-lg">{characterOf(p)}</span>
                          <span className="text-[13px] truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="family-pin-input" className="block text-[12px] font-display font-bold text-foreground-muted mb-1">
                    4자리 PIN 번호
                  </label>
                  <input
                    id="family-pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full text-center tracking-[0.5em] font-display font-bold text-xl py-2.5 bg-surface border-2 border-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                {authError && (
                  <p className="text-[12px] font-bold text-destructive text-center">{authError}</p>
                )}

                <button
                  type="submit"
                  disabled={authBusy || pin.length !== 4}
                  className="w-full bg-secondary-dark text-on-secondary font-display font-bold py-2.5 rounded-md border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition disabled:opacity-50"
                >
                  {authBusy ? '확인 중...' : '부모 인증하고 관리하기'}
                </button>
              </form>
            </div>
          ) : mode === 'list' ? (
            /* 구성원 목록 모드 */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-display font-bold text-foreground-muted">
                  총 {members.length}명의 가족 식구
                </span>
                <button
                  type="button"
                  onClick={startAdd}
                  className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md px-3 py-1.5 text-[12px] font-display font-bold shadow-sticker flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition"
                >
                  <i className="ph-bold ph-user-plus text-sm" aria-hidden="true"></i>
                  <span>새 식구 추가</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {members.map((m) => {
                  const isLastParent = m.role === 'parent' && parentCount <= 1
                  return (
                    <div
                      key={m.member_id}
                      className="p-3 bg-surface border-2 border-foreground rounded-md shadow-sticker flex items-center justify-between gap-3 relative overflow-hidden"
                    >
                      {/* 대표 컬러 띠 */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ backgroundColor: m.color || '#3b82f6' }}
                      />

                      <div className="flex items-center gap-3 pl-1.5 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-surface-muted border border-border flex items-center justify-center text-2xl shrink-0">
                          {characterOf(m)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-display font-bold text-[15px] text-foreground truncate">
                              {m.name}
                            </p>
                            <span
                              className={`text-[10px] font-display font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                m.role === 'parent'
                                  ? 'bg-secondary-dark text-on-secondary border-foreground'
                                  : 'bg-tape-yellow text-foreground border-foreground'
                              }`}
                            >
                              {m.role === 'parent' ? '부모' : '자녀'}
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground-muted">
                            {m.role === 'parent' ? '보호자 관리 권한' : '자녀 모드'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="w-8 h-8 rounded-md bg-surface-muted border border-border flex items-center justify-center text-foreground hover:bg-surface active:scale-95 transition"
                          title="식구 정보 수정"
                          aria-label={`${m.name} 정보 수정`}
                        >
                          <i className="ph-bold ph-pencil-simple text-sm" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          disabled={isLastParent}
                          onClick={() => {
                            setDeleteError('')
                            setMemberToDelete(m)
                          }}
                          className="w-8 h-8 rounded-md bg-surface-muted border border-border flex items-center justify-center text-destructive hover:bg-destructive/10 active:scale-95 transition disabled:opacity-30 disabled:hover:bg-surface-muted"
                          title={isLastParent ? '마지막 부모는 삭제할 수 없습니다' : '식구 삭제'}
                          aria-label={`${m.name} 삭제`}
                        >
                          <i className="ph-bold ph-trash text-sm" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* 추가/수정 폼 모드 */
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="font-display font-bold text-[15px] text-foreground">
                  {mode === 'add' ? '새 식구 추가하기' : `${editingMember?.name} 정보 수정`}
                </h3>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="text-[12px] text-foreground-muted hover:text-foreground underline"
                >
                  목록으로 돌아가기
                </button>
              </div>

              {/* 이름 입력 */}
              <div>
                <label htmlFor="member-name" className="block text-[12px] font-display font-bold text-foreground mb-1">
                  이름 <span className="text-destructive">*</span>
                </label>
                <input
                  id="member-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="식구 이름을 입력해주세요 (예: 윤서, 아빠)"
                  maxLength={20}
                  className="w-full px-3 py-2 bg-surface border-2 border-foreground rounded-md font-display text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              {/* 역할 선택 */}
              <div>
                <label className="block text-[12px] font-display font-bold text-foreground mb-1">
                  역할 구분
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('parent')}
                    className={`py-2 px-3 rounded-md border-2 flex items-center justify-center gap-1.5 font-display font-bold text-[13px] transition ${
                      role === 'parent'
                        ? 'bg-secondary-dark text-on-secondary border-foreground shadow-sticker'
                        : 'bg-surface border-border text-foreground hover:bg-surface-muted'
                    }`}
                  >
                    <span>👑 부모</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('child')}
                    className={`py-2 px-3 rounded-md border-2 flex items-center justify-center gap-1.5 font-display font-bold text-[13px] transition ${
                      role === 'child'
                        ? 'bg-tape-yellow text-foreground border-foreground shadow-sticker'
                        : 'bg-surface border-border text-foreground hover:bg-surface-muted'
                    }`}
                  >
                    <span>🐣 자녀</span>
                  </button>
                </div>
                {mode === 'edit' && editingMember?.role === 'parent' && parentCount <= 1 && (
                  <p className="text-[11px] text-foreground-muted mt-1">
                    * 현재 부모가 1명이므로 자녀로 변경할 수 없어요.
                  </p>
                )}
              </div>

              {/* 12지신 띠 캐릭터 선택 */}
              <div>
                <label className="block text-[12px] font-display font-bold text-foreground mb-1">
                  12간지 캐릭터 (아바타)
                </label>
                <div className="p-3 bg-surface-muted border border-border rounded-md">
                  <CharacterPicker value={avatar} onSelect={setAvatar} size="sm" />
                </div>
              </div>

              {/* 대표 색상 선택 */}
              <div>
                <label className="block text-[12px] font-display font-bold text-foreground mb-1">
                  대표 테마 색상
                </label>
                <div className="flex items-center gap-2">
                  {PALETTE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`w-7 h-7 rounded-full transition-transform active:scale-90 flex items-center justify-center ${
                        color === c.value
                          ? 'ring-2 ring-foreground ring-offset-2 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                      aria-label={c.label}
                    >
                      {color === c.value && (
                        <i className="ph-bold ph-check text-white text-xs" aria-hidden="true"></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-[12px] font-bold text-destructive">{formError}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={formBusy}
                  className="flex-1 bg-secondary-dark text-on-secondary font-display font-bold py-2.5 rounded-md border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition disabled:opacity-50"
                >
                  {formBusy ? '저장 중...' : mode === 'add' ? '새 식구 등록하기' : '수정 완료'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-4 py-2.5 bg-surface border-2 border-border rounded-md font-display font-bold text-foreground hover:bg-surface-muted active:scale-95 transition text-[13px]"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 삭제 확인 팝업 모달 */}
        {memberToDelete && (
          <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] z-[90] flex items-center justify-center p-4">
            <div className="bg-surface border-2 border-foreground rounded-lg shadow-sticker max-w-xs w-full p-4 space-y-3 animate-in fade-in zoom-in duration-100">
              <div className="text-center space-y-1">
                <span className="text-3xl block" aria-hidden="true">
                  {characterOf(memberToDelete)}
                </span>
                <h4 className="font-display font-bold text-[16px] text-foreground">
                  ‘{memberToDelete.name}’ 식구를 삭제할까요?
                </h4>
                <p className="text-[12px] text-foreground-muted leading-relaxed">
                  스케줄, 할일, 옷장 등 연결된 기록도 함께 정리됩니다. 정말 삭제하시겠습니까?
                </p>
              </div>

              {deleteError && (
                <p className="text-[12px] font-bold text-destructive text-center">
                  {deleteError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleteBusy}
                  className="flex-1 bg-destructive text-on-destructive font-display font-bold py-2 rounded-md border-2 border-foreground shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition text-[13px] disabled:opacity-50"
                >
                  {deleteBusy ? '삭제 중...' : '삭제하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  disabled={deleteBusy}
                  className="flex-1 bg-surface border-2 border-border font-display font-bold py-2 rounded-md hover:bg-surface-muted active:scale-95 transition text-[13px]"
                >
                  그만두기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
