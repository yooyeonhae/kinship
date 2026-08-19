-- migration_10 — 가족 이름 중복 금지
--
-- 지금은 같은 이름의 가족을 몇 개든 만들 수 있다. 이 앱은 로그인이 없고 가족 이름이
-- 헤더에도 화면에도 그 가족을 가리키는 유일한 사람 눈높이 이름이라, 중복이 생기면
-- "우리집"이 여러 개가 되어 초대 링크를 잘못 받았을 때 구분할 방법이 없다.
--
-- ── 실행 전에 확인할 것 ────────────────────────────────────────────────
-- 이미 중복이 있으면 아래 unique 인덱스 생성이 실패한다. 먼저 이 질의로 확인한다:
--
--   select lower(btrim(name)) as key, count(*), array_agg(family_id)
--   from families group by 1 having count(*) > 1;
--
-- 결과가 나오면 어느 쪽을 남길지 사람이 정해야 한다 — 가족 데이터라 자동으로
-- 지우거나 이름을 바꾸는 처리를 여기 넣지 않았다. 남길 가족을 정한 뒤 나머지의
-- 이름을 손으로 바꾸거나(권장), 비어 있는 가족이면 삭제하고 다시 실행할 것.
-- ──────────────────────────────────────────────────────────────────────

-- 대소문자와 앞뒤 공백만 다른 이름도 사람 눈에는 같은 이름이다.
-- "우리집"과 "우리집 "이 공존하면 중복을 막는 의미가 없다.
create unique index if not exists families_name_unique_idx
  on families (lower(btrim(name)));

-- create_family가 중복을 알아보고 화면이 쓸 수 있는 형태로 돌려주게 한다.
-- 잡지 않으면 unique_violation이 그대로 올라가 클라이언트에는 정체 모를 오류로만 보인다.
create or replace function create_family(p_name text, p_members jsonb)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family_id uuid := gen_random_uuid();
  v_m jsonb;
  v_count int := 0;
begin
  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    return json_build_object('ok', false, 'error', 'members_required');
  end if;

  -- 먼저 전부 검증한다. insert를 시작한 뒤 return하면 plpgsql은 롤백하지 않으므로
  -- (return은 raise가 아니다) 이미 넣은 families 행이 고아로 남는다.
  for v_m in select * from jsonb_array_elements(p_members) loop
    if coalesce(trim(v_m ->> 'name'), '') = '' then
      return json_build_object('ok', false, 'error', 'member_name_required');
    end if;
    if (v_m ->> 'role') not in ('parent', 'child') then
      return json_build_object('ok', false, 'error', 'member_role_invalid');
    end if;
  end loop;

  -- 중복은 미리 select로 확인하지 않고 insert의 제약으로 판단한다. 확인과 insert
  -- 사이에 다른 요청이 같은 이름을 넣으면 확인이 통과해도 결국 실패하기 때문이다.
  begin
    insert into families (family_id, name) values (v_family_id, trim(p_name));
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'name_taken');
  end;

  for v_m in select * from jsonb_array_elements(p_members) loop
    insert into members (family_id, name, role)
      values (v_family_id, trim(v_m ->> 'name'), v_m ->> 'role');
    v_count := v_count + 1;
  end loop;

  return json_build_object('ok', true, 'family_id', v_family_id, 'member_count', v_count);
end $$;
