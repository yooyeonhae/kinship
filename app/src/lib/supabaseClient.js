import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 로그인이 없으므로 신원은 전부 헤더로 전달한다 (app/supabase/policies.sql,
// migration_02_roles_and_parent_pin.sql 참고).
//   x-family-id    가족 범위
//   x-member-id    지금 누구로 쓰는지 — 자기신고값이므로 자녀 수준 동작에만 쓰인다
//   x-parent-token parent_login()이 발급한 토큰. 부모 권한의 유일한 근거.
export function createSupabaseClient(familyId, memberId, parentToken) {
  const headers = {}
  if (familyId) headers['x-family-id'] = familyId
  if (memberId) headers['x-member-id'] = memberId
  if (parentToken) headers['x-parent-token'] = parentToken

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: Object.keys(headers).length > 0 ? { headers } : {},
  })
}
