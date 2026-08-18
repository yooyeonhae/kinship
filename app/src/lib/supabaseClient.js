import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// family_id는 로그인 없이 x-family-id 헤더로 전달 (app/supabase/policies.sql 참고)
export function createSupabaseClient(familyId) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: familyId ? { headers: { 'x-family-id': familyId } } : {},
  })
}
