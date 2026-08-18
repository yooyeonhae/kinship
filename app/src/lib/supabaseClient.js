import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 로그인이 없으므로 신원은 전부 헤더로 전달한다 (app/supabase/policies.sql,
// migration_02_roles_and_parent_pin.sql 참고).
//   x-family-id    가족 범위
//   x-member-id    지금 누구로 쓰는지 — 자기신고값이므로 자녀 수준 동작에만 쓰인다
//   x-parent-token parent_login()이 발급한 토큰. 부모 권한의 유일한 근거.
//
// FamilyContext는 이 값들이 바뀔 때마다 새 createClient()를 호출했었는데,
// 사람을 전환하거나 로그인/로그아웃할 때마다 GoTrueClient 인스턴스가 새로 생겨서
// 브라우저 콘솔에 "Multiple GoTrueClient instances" 경고가 쌓였다(같은 storage key를
// 여러 인스턴스가 공유하는 건 미정의 동작의 여지가 있다). 이 앱은 Supabase Auth를
// 쓰지 않으므로 세션 저장 자체를 끄고, 클라이언트는 하나만 만들어 fetch를 감싸서
// 현재 신원을 요청마다 주입한다.
const identity = { familyId: null, memberId: null, parentToken: null }

export function setIdentity(next) {
  identity.familyId = next.familyId || null
  identity.memberId = next.memberId || null
  identity.parentToken = next.parentToken || null
}

function identityFetch(input, init = {}) {
  const headers = new Headers(init.headers)
  if (identity.familyId) headers.set('x-family-id', identity.familyId)
  if (identity.memberId) headers.set('x-member-id', identity.memberId)
  if (identity.parentToken) headers.set('x-parent-token', identity.parentToken)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: identityFetch },
})
