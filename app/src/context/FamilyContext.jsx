import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '../lib/supabaseClient'

const FAMILY_ID_KEY = 'kinship_family_id'
const MEMBER_ID_KEY = 'kinship_member_id'
const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const [familyId, setFamilyId] = useState(() => localStorage.getItem(FAMILY_ID_KEY))
  // "지금 누구로 앱을 쓰는 중인지". EntryScreen에서 고른 사람이 여기에 들어간다.
  // 주의: 이 값은 아직 클라이언트에만 존재하는 자기신고값이라 권한의 근거가 아니다.
  // 서버에서 역할을 강제하려면 x-member-id 헤더 + 역할 기반 RLS가 필요하다.
  const [currentMemberId, setCurrentMemberId] = useState(() => localStorage.getItem(MEMBER_ID_KEY))
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const supabase = useMemo(() => createSupabaseClient(familyId), [familyId])

  const setCurrentMember = useCallback((memberId) => {
    if (memberId) localStorage.setItem(MEMBER_ID_KEY, memberId)
    else localStorage.removeItem(MEMBER_ID_KEY)
    setCurrentMemberId(memberId || null)
  }, [])

  const clearFamily = useCallback(() => {
    localStorage.removeItem(FAMILY_ID_KEY)
    localStorage.removeItem(MEMBER_ID_KEY)
    setFamilyId(null)
    setCurrentMemberId(null)
    setMembers([])
    setLoadError(null)
  }, [])

  const reload = useCallback(async () => {
    if (!familyId) {
      setMembers([])
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
      .select('family_id')
      .eq('family_id', familyId)
      .maybeSingle()

    if (familyError) {
      // 22P02: localStorage 값이 UUID 형식이 아니라 모든 쿼리가 실패하는 상태 → 되살릴 수 없으므로 초기화
      if (familyError.code === '22P02') {
        clearFamily()
        return
      }
      setLoadError('network')
      setLoading(false)
      return
    }

    if (!family) {
      clearFamily()
      return
    }

    const { data, error } = await supabase.from('members').select('*').order('created_at').order('member_id')
    if (error) {
      setLoadError('network')
      setLoading(false)
      return
    }
    setMembers(data || [])
    setLoading(false)
  }, [familyId, supabase, clearFamily])

  useEffect(() => {
    reload()
  }, [reload])

  const createFamily = useCallback(async (name, memberDrafts) => {
    // family_id를 클라이언트에서 만들어야 x-family-id 헤더와 값이 일치한다.
    // DB가 기본값으로 생성하게 두면 헤더와 다른 값이 되어 families의 SELECT 정책이
    // INSERT ... RETURNING 행을 막고, INSERT 전체가 롤백된다.
    const newFamilyId = crypto.randomUUID()
    const client = createSupabaseClient(newFamilyId)

    const { error: familyError } = await client.from('families').insert({ family_id: newFamilyId, name })
    if (familyError) throw familyError

    const { error: membersError } = await client
      .from('members')
      .insert(memberDrafts.map((m) => ({ family_id: newFamilyId, name: m.name, role: m.role })))
    if (membersError) {
      // 이미 커밋된 families 행을 되돌린다. 되돌리지 못하면 재시도마다 고아 행이 쌓인다.
      // supabase/migration_01_families_delete.sql이 적용되지 않았다면 이 삭제는
      // 조용히 0건이 되므로, 실패 원인은 그대로 아래에서 던진다.
      await client.from('families').delete().eq('family_id', newFamilyId)
      throw membersError
    }

    localStorage.setItem(FAMILY_ID_KEY, newFamilyId)
    setFamilyId(newFamilyId)
  }, [])

  const currentMember = useMemo(
    () => members.find((m) => m.member_id === currentMemberId) || null,
    [members, currentMemberId]
  )

  // 저장된 멤버가 더 이상 이 가족에 없으면(삭제됨/다른 가족으로 바뀜) 선택을 비운다.
  // 비우지 않으면 존재하지 않는 사람으로 앱을 쓰는 상태가 된다.
  useEffect(() => {
    if (loading || loadError) return
    if (currentMemberId && !currentMember) setCurrentMember(null)
  }, [loading, loadError, currentMemberId, currentMember, setCurrentMember])

  const value = useMemo(
    () => ({
      familyId,
      members,
      loading,
      loadError,
      supabase,
      createFamily,
      resetFamily: clearFamily,
      reload,
      currentMemberId,
      currentMember,
      setCurrentMember,
      isParent: currentMember?.role === 'parent',
      isChild: currentMember?.role === 'child',
    }),
    [
      familyId,
      members,
      loading,
      loadError,
      supabase,
      createFamily,
      clearFamily,
      reload,
      currentMemberId,
      currentMember,
      setCurrentMember,
    ]
  )

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within a FamilyProvider')
  return ctx
}
