-- migration_02 보안 결함 수정: set_parent_pin을 통한 PIN 무제한 추측
-- Supabase Dashboard → SQL Editor에서 New query로 실행한다.
--
-- ============================================================================
-- 발견된 문제
-- ============================================================================
-- migration_02의 parent_login()은 5회 실패 시 15분 잠금이 걸린다. 그런데
-- set_parent_pin()의 old_pin 검증에는 횟수 제한도, 잠금 확인도 없었다.
-- 따라서 공격자는 parent_login 대신
--     set_parent_pin(member_id, '0000', <추측>)
-- 을 반복해서 4자리 PIN(1만 가지)을 아무 제한 없이 전수 탐색할 수 있었다.
-- 잠금이 걸린 상태에서도 이 경로는 계속 열려 있었다(REST로 실제 확인).
-- 맞히면 PIN을 새 값으로 바꿔버릴 수 있어서, 진짜 부모를 잠가버리는 것도 가능했다.
--
-- 수정
--   1) set_parent_pin도 locked_until을 확인한다.
--   2) old_pin 불일치 시 parent_login과 "같은" failed_attempts 카운터를 올린다.
--      → 두 경로를 합쳐 5회로 제한되므로 우회가 사라진다.
--   3) 최초 PIN 설정 선점 방지: 이 가족에 이미 PIN을 설정한 부모가 있으면,
--      다른 부모의 최초 PIN 설정에는 인증된 부모 토큰을 요구한다.
--      (그렇지 않으면 family_id를 아는 사람이 PIN 없는 부모의 PIN을 선점할 수 있다.
--       가족의 첫 PIN 자체는 여전히 선점 가능하다 — family_id가 유일한 공유 비밀인
--       이 계층에서는 구조적 한계이므로, 온보딩 직후 바로 설정하도록 UI에서 유도한다.)

create or replace function set_parent_pin(p_member_id uuid, p_new_pin text, p_old_pin text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_existing parent_pins;
  v_max_attempts constant int := 5;
  v_lock_duration constant interval := interval '15 minutes';
begin
  if v_family is null then
    return json_build_object('ok', false, 'error', 'family_required');
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'error', 'pin_must_be_4_digits');
  end if;
  if not exists (
    select 1 from members m
    where m.member_id = p_member_id and m.family_id = v_family and m.role = 'parent'
  ) then
    return json_build_object('ok', false, 'error', 'not_a_parent');
  end if;

  select * into v_existing from parent_pins where member_id = p_member_id;

  -- ---------- 기존 PIN 변경 ----------
  if v_existing.member_id is not null then
    -- (1) 잠금 확인. 이게 없어서 잠긴 동안에도 추측이 가능했다.
    if v_existing.locked_until is not null and v_existing.locked_until > now() then
      return json_build_object('ok', false, 'error', 'locked', 'locked_until', v_existing.locked_until);
    end if;

    -- (2) 불일치 시 parent_login과 같은 카운터를 올린다.
    --     반환값으로 알리는 것이 중요하다 — raise하면 트랜잭션이 롤백되어
    --     이 증가분까지 사라지고 잠금이 영원히 걸리지 않는다.
    if p_old_pin is null or v_existing.pin_hash <> crypt(p_old_pin, v_existing.pin_hash) then
      update parent_pins
        set failed_attempts = failed_attempts + 1,
            locked_until = case
              when failed_attempts + 1 >= v_max_attempts then now() + v_lock_duration
              else null
            end
        where member_id = p_member_id;
      return json_build_object('ok', false, 'error', 'old_pin_mismatch',
        'attempts_left', greatest(0, v_max_attempts - (v_existing.failed_attempts + 1)));
    end if;

    update parent_pins
      set pin_hash = crypt(p_new_pin, gen_salt('bf')),
          failed_attempts = 0, locked_until = null, updated_at = now()
      where member_id = p_member_id;
    delete from parent_sessions where member_id = p_member_id;
    return json_build_object('ok', true, 'created', false);
  end if;

  -- ---------- 최초 PIN 설정 ----------
  -- (3) 이 가족에 이미 PIN을 설정한 부모가 있으면 인증된 부모만 추가할 수 있다.
  --     is_parent()로 검사하면 안 된다 — PIN이 없는 부모는 자기신고로 통과하므로
  --     정작 막으려는 대상이 그대로 통과한다. 반드시 토큰 존재를 본다.
  if exists (select 1 from parent_pins p where p.family_id = v_family)
     and token_parent_id() is null then
    return json_build_object('ok', false, 'error', 'parent_auth_required');
  end if;

  insert into parent_pins (member_id, family_id, pin_hash)
    values (p_member_id, v_family, crypt(p_new_pin, gen_salt('bf')));
  return json_build_object('ok', true, 'created', true);
end $$;

grant execute on function set_parent_pin(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
