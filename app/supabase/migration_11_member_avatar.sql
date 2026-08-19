-- migration_11 — 구성원 캐릭터(아바타)
--
-- 지금 아바타는 이름 첫 글자를 색 원에 얹은 것뿐이라, 글자를 못 읽는 아이는 자기
-- 자리를 색으로만 구분한다. 형제 이름의 첫 글자가 같으면(서아·서연) 색밖에 단서가 없다.
-- 캐릭터를 직접 고르게 해서 "내 것"을 한눈에 알아보게 한다.
--
-- 이미지 파일이 아니라 이모지 한 글자를 담는다. 파일을 쓰면 Storage 버킷과 업로드
-- 권한이 필요하고, 그건 지금 필요한 것(자기 자리 구분)에 비해 과하다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table members
  add column if not exists avatar text;

alter table members
  drop constraint if exists members_avatar_check;

-- 이모지는 코드포인트 여러 개로 조합되는 경우가 많아(예: 👨‍👩‍👧는 8글자) 1자로 못 박을 수 없다.
-- 대신 상한만 둬서 긴 문자열이 들어오는 것을 막는다.
alter table members
  add constraint members_avatar_check
  check (avatar is null or length(avatar) between 1 and 16);

-- create_family가 캐릭터까지 함께 넣게 한다.
-- 온보딩에서 고른 캐릭터를 나중에 UPDATE로 채울 수는 없다 — members 쓰기는 부모 전용이고
-- 가족을 막 만든 시점에는 부모 토큰이 아직 없다. 그러니 생성 시점에 같이 넣어야 한다.
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

  -- 중복은 미리 select로 확인하지 않고 insert의 제약으로 판단한다(migration_10 참고).
  begin
    insert into families (family_id, name) values (v_family_id, trim(p_name));
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'name_taken');
  end;

  for v_m in select * from jsonb_array_elements(p_members) loop
    insert into members (family_id, name, role, avatar)
      values (
        v_family_id,
        trim(v_m ->> 'name'),
        v_m ->> 'role',
        nullif(btrim(coalesce(v_m ->> 'avatar', '')), '')
      );
    v_count := v_count + 1;
  end loop;

  return json_build_object('ok', true, 'family_id', v_family_id, 'member_count', v_count);
end $$;
