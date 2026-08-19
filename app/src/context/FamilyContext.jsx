import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, setIdentity, familyExists } from '../lib/supabaseClient'

const FAMILY_ID_KEY = 'kinship_family_id'
const MEMBER_ID_KEY = 'kinship_member_id'
const PARENT_AUTH_KEY = 'kinship_parent_auth'

const FamilyContext = createContext(null)

function readParentAuth() {
  try {
    const raw = localStorage.getItem(PARENT_AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.memberId) return null
    return parsed
  } catch {
    return null
  }
}

export function FamilyProvider({ children }) {
  const [familyId, setFamilyId] = useState(() => localStorage.getItem(FAMILY_ID_KEY))
  // "지금 누구로 앱을 쓰는 중인지". 자기신고값이므로 자녀 수준 동작에만 근거가 된다.
  const [currentMemberId, setCurrentMemberId] = useState(() => localStorage.getItem(MEMBER_ID_KEY))
  // parent_login()이 발급한 토큰. 부모 권한의 유일한 근거.
  const [parentAuth, setParentAuth] = useState(readParentAuth)
  const [members, setMembers] = useState([])
  const [familyName, setFamilyName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const authExpired = parentAuth?.expiresAt ? new Date(parentAuth.expiresAt).getTime() <= Date.now() : false

  // 토큰은 그 토큰의 주인으로 앱을 쓰고 있을 때만 보낸다.
  // 부모가 로그인한 뒤 자녀로 전환했는데 토큰이 계속 실려 나가면
  // 그 자녀가 부모 권한을 그대로 쓰게 된다.
  const activeToken =
    parentAuth && !authExpired && parentAuth.memberId === currentMemberId ? parentAuth.token : null

  // 렌더 시점에 동기적으로 반영한다(useEffect가 아니다). supabase 클라이언트는 앱 전체에서
  // 하나뿐인 싱글톤이고 이 값들을 fetch가 요청마다 읽어가므로, 자식 컴포넌트의 effect가
  // 실행되기 전에(= 이 컴포넌트의 렌더가 커밋되기 전에) 최신 신원이 반영되어 있어야 한다.
  // useEffect로 미루면 "새 memberId로 리렌더 → 자식 마운트·effect 발동 → 아직 이전 identity로
  // fetch가 나감 → 뒤늦게 identity effect 실행"이라는 순서가 생길 수 있다.
  setIdentity({ familyId, memberId: currentMemberId, parentToken: activeToken })

  const setCurrentMember = useCallback((memberId) => {
    if (memberId) localStorage.setItem(MEMBER_ID_KEY, memberId)
    else localStorage.removeItem(MEMBER_ID_KEY)
    setCurrentMemberId(memberId || null)
  }, [])

  const clearParentAuth = useCallback(() => {
    localStorage.removeItem(PARENT_AUTH_KEY)
    setParentAuth(null)
  }, [])

  const clearFamily = useCallback(() => {
    localStorage.removeItem(FAMILY_ID_KEY)
    localStorage.removeItem(MEMBER_ID_KEY)
    localStorage.removeItem(PARENT_AUTH_KEY)
    setFamilyId(null)
    setCurrentMemberId(null)
    setParentAuth(null)
    setMembers([])
    setFamilyName(null)
    setLoadError(null)
  }, [])

  // 만료된 토큰은 붙들고 있을 이유가 없다
  useEffect(() => {
    if (parentAuth && authExpired) clearParentAuth()
  }, [parentAuth, authExpired, clearParentAuth])

  const reload = useCallback(async () => {
    if (!familyId) {
      setMembers([])
      setFamilyName(null)
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)

    // localStorage의 family_id가 실제로 살아있는지 먼저 확인한다.
    // 존재하지 않는 id로는 모든 조회가 에러 없이 빈 배열을 돌려주기 때문에,
    // 확인하지 않으면 빠져나갈 수 없는 빈 화면에 갇힌다.
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('family_id, name')
      .eq('family_id', familyId)
      .maybeSingle()

    if (familyError) {
      setLoadError('network')
      setLoading(false)
      return
    }
    if (!family) {
      clearFamily()
      return
    }
    setFamilyName(family.name || null)

    const { data, error } = await supabase.from('members').select('*').order('created_at').order('member_id')
    if (error) {
      setLoadError('network')
      setLoading(false)
      return
    }
    setMembers(data || [])
    setLoading(false)
  }, [familyId, clearFamily])

  useEffect(() => {
    reload()
  }, [reload])

  // 가족 생성은 create_family() RPC 한 번으로 처리한다.
  // 클라이언트에서 families → members를 따로 insert하면 (a) members 실패 시
  // families가 고아로 남고, (b) members 쓰기 정책이 부모 전용이라 최초 생성이 막히고,
  // (c) families의 INSERT ... RETURNING이 SELECT 정책에 걸린다.
  // RPC 자체는 family_id를 요구하지 않으므로 헤더 없이도 호출된다.
  const createFamily = useCallback(async (name, memberDrafts) => {
    const { data, error } = await supabase.rpc('create_family', {
      p_name: name,
      p_members: memberDrafts.map((m) => ({ name: m.name, role: m.role })),
    })
    if (error) throw error
    if (!data?.ok) throw new Error(data?.error || 'create_family_failed')

    localStorage.setItem(FAMILY_ID_KEY, data.family_id)
    setFamilyId(data.family_id)
    return data.family_id
  }, [])

  // 이미 만들어진 가족을 다른 기기/브라우저에서 이어서 쓰기 위한 경로.
  // 이게 없으면 localStorage가 비워질 때마다 온보딩을 처음부터 다시 해야 한다.
  const joinFamily = useCallback(async (rawId) => {
    const id = (rawId || '').trim()
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return { ok: false, error: 'format' }
    let family
    try {
      family = await familyExists(id)
    } catch {
      return { ok: false, error: 'network' }
    }
    if (!family) return { ok: false, error: 'not_found' }
    localStorage.setItem(FAMILY_ID_KEY, id)
    localStorage.removeItem(MEMBER_ID_KEY)
    localStorage.removeItem(PARENT_AUTH_KEY)
    setCurrentMemberId(null)
    setParentAuth(null)
    setFamilyId(id)
    return { ok: true, name: family.name }
  }, [])

  const parentLogin = useCallback(async (memberId, pin) => {
    const { data, error } = await supabase.rpc('parent_login', { p_member_id: memberId, p_pin: pin })
    if (error) return { ok: false, error: 'network' }
    if (data?.ok) {
      const auth = { token: data.token, memberId: data.member_id, expiresAt: data.expires_at }
      localStorage.setItem(PARENT_AUTH_KEY, JSON.stringify(auth))
      setParentAuth(auth)
    }
    return data
  }, [])

  const parentLogout = useCallback(async () => {
    await supabase.rpc('parent_logout')
    clearParentAuth()
  }, [clearParentAuth])

  const setParentPin = useCallback(async (memberId, newPin, oldPin = null) => {
    const { data, error } = await supabase.rpc('set_parent_pin', {
      p_member_id: memberId,
      p_new_pin: newPin,
      p_old_pin: oldPin,
    })
    if (error) return { ok: false, error: 'network' }
    return data
  }, [])

  const currentMember = useMemo(
    () => members.find((m) => m.member_id === currentMemberId) || null,
    [members, currentMemberId]
  )

  // 저장된 멤버가 더 이상 이 가족에 없으면(삭제됨/다른 가족으로 바뀜) 선택을 비운다.
  useEffect(() => {
    if (loading || loadError) return
    if (currentMemberId && !currentMember) setCurrentMember(null)
  }, [loading, loadError, currentMemberId, currentMember, setCurrentMember])

  const value = useMemo(
    () => ({
      familyId,
      familyName,
      members,
      loading,
      loadError,
      supabase,
      reload,
      createFamily,
      joinFamily,
      resetFamily: clearFamily,
      currentMemberId,
      currentMember,
      setCurrentMember,
      isChild: currentMember?.role === 'child',
      // 역할만 보는 값. 실제 쓰기 권한은 아래 isParentAuthed가 결정한다.
      isParentRole: currentMember?.role === 'parent',
      // 서버가 부모 쓰기를 허용하는 상태인지. 토큰이 없으면 화면에 들어가도 전부 거부된다.
      isParentAuthed: currentMember?.role === 'parent' && activeToken !== null,
      parentAuth,
      parentLogin,
      parentLogout,
      setParentPin,
    }),
    [
      familyId,
      familyName,
      members,
      loading,
      loadError,
      reload,
      createFamily,
      joinFamily,
      clearFamily,
      currentMemberId,
      currentMember,
      setCurrentMember,
      activeToken,
      parentAuth,
      parentLogin,
      parentLogout,
      setParentPin,
    ]
  )

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within a FamilyProvider')
  return ctx
}
