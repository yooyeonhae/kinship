-- 권한 모델 B단계 3~4: 역할 기반 RLS + 부모 PIN + 자녀 완료 RPC
-- Supabase Dashboard → SQL Editor에 전체를 붙여넣고 한 번에 실행한다.
-- 이 파일은 재실행 가능하게 작성했다(if not exists / or replace / drop policy if exists).
--
-- ============================================================================
-- 무엇이 바뀌는가
-- ============================================================================
-- 지금까지: 요청에 실리는 건 x-family-id 하나뿐이라 DB가 부모/자녀를 구분하지 못했고,
--           React의 역할 게이팅은 장식이었다.
-- 이후:     요청에 3개가 실린다.
--             x-family-id     — 가족 범위 (기존)
--             x-member-id     — 지금 누구로 쓰는지 (자기신고값, 자녀 수준 동작에만 사용)
--             x-parent-token  — 부모임을 증명하는 서버 발급 토큰 (PIN 없이는 얻을 수 없음)
--
-- 강제되는 규칙
--   todos  조회        : 가족 전체 (부모·자녀 동일)
--   todos  생성/삭제/수정: 부모만
--   todos  완료 체크    : 자녀는 toggle_my_todo() RPC로 "자기 담당" 항목만
--   members 쓰기       : 부모만
--   weekly_outfit_rules 쓰기: 부모만
--
-- ============================================================================
-- 남는 한계 (반드시 인지)
-- ============================================================================
-- 1) x-member-id는 자기신고값이다. 자녀 A가 자녀 B의 member_id를 넣으면 B의 할일을
--    체크할 수 있다. 형제간 장난은 막지 못한다. 아이별 자격증명을 두지 않는 한
--    구조적으로 그렇다("아이는 그냥 앱을 연다"는 전제와 상충).
-- 2) PIN을 아직 설정하지 않은 부모는 예전처럼 자기신고로 부모 권한을 얻는다.
--    이 마이그레이션이 기존 가족을 깨뜨리지 않게 하기 위한 의도적 설계다.
--    PIN을 설정하면 그 부모에 대해서만 실제 강제가 켜진다(가족 단위 플래그 없음).
-- 3) 따라서 "PIN을 아는 사람 = 부모"까지가 이 시스템이 주장할 수 있는 최대치다.
--    진짜 사용자 인증(Supabase Auth)은 아니다.
-- 4) PIN이 아직 없는 부모의 첫 PIN은 family_id를 아는 사람이면 누구나 설정할 수 있다.
--    온보딩 직후 부모가 바로 설정하도록 UI에서 유도해야 한다.

-- ============================================================================
-- 0. 헤더 파싱 (잘못된 값이 와도 전체 쿼리가 죽지 않게)
-- ============================================================================

-- 기존 current_family_id()는 헤더를 무조건 ::uuid로 캐스팅해서, localStorage에
-- 깨진 값이 들어가면 모든 요청이 22P02로 실패했다. 정규식으로 먼저 걸러 null을 준다.
create or replace function safe_uuid(p text) returns uuid
language sql immutable as $$
  select case
    when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then p::uuid
    else null
  end
$$;

create or replace function request_header(p_name text) returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true)::json ->> p_name, '')
$$;

create or replace function current_family_id() returns uuid
language sql stable as $$
  select safe_uuid(request_header('x-family-id'))
$$;

create or replace function current_member_id() returns uuid
language sql stable as $$
  select safe_uuid(request_header('x-member-id'))
$$;

create or replace function current_parent_token() returns uuid
language sql stable as $$
  select safe_uuid(request_header('x-parent-token'))
$$;

-- ============================================================================
-- 1. PIN / 세션 테이블
--    두 테이블 모두 RLS를 켜고 정책을 하나도 만들지 않는다.
--    → anon은 REST로 접근 불가. 아래 security definer 함수만 다룬다.
-- ============================================================================

create table if not exists parent_pins (
  member_id      uuid primary key references members (member_id) on delete cascade,
  family_id      uuid not null references families (family_id) on delete cascade,
  pin_hash       text not null,
  failed_attempts int not null default 0,
  locked_until   timestamptz,
  updated_at     timestamptz not null default now()
);
alter table parent_pins enable row level security;

create table if not exists parent_sessions (
  token      uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members (member_id) on delete cascade,
  family_id  uuid not null references families (family_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table parent_sessions enable row level security;

create index if not exists parent_sessions_lookup on parent_sessions (token, family_id);

-- ============================================================================
-- 2. 역할 판정
-- ============================================================================

-- 유효한 부모 토큰이 가리키는 member_id (없으면 null)
create or replace function token_parent_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.member_id
  from parent_sessions s
  join members m on m.member_id = s.member_id
  where s.token = current_parent_token()
    and s.family_id = current_family_id()
    and s.expires_at > now()
    and m.role = 'parent'
$$;

create or replace function is_parent() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select
    token_parent_id() is not null
    or exists (
      -- PIN을 설정하지 않은 부모는 자기신고를 받아들인다(마이그레이션 호환).
      -- PIN을 설정하면 이 경로가 닫힌다.
      select 1
      from members m
      where m.member_id = current_member_id()
        and m.family_id = current_family_id()
        and m.role = 'parent'
        and not exists (select 1 from parent_pins p where p.member_id = m.member_id)
    )
$$;

-- 실제로 동작을 수행하는 멤버 (완료자 기록용). 토큰이 있으면 그 부모, 없으면 자기신고 멤버.
create or replace function acting_member_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    token_parent_id(),
    (select m.member_id from members m
      where m.member_id = current_member_id()
        and m.family_id = current_family_id())
  )
$$;

-- ============================================================================
-- 3. 정책 교체
-- ============================================================================

-- todos: 조회는 가족 전체, 쓰기는 부모만
drop policy if exists "todos_own_family" on todos;
drop policy if exists "todos_select_family" on todos;
drop policy if exists "todos_parent_insert" on todos;
drop policy if exists "todos_parent_update" on todos;
drop policy if exists "todos_parent_delete" on todos;

create policy "todos_select_family" on todos
  for select using (family_id = current_family_id());

create policy "todos_parent_insert" on todos
  for insert with check (family_id = current_family_id() and is_parent());

create policy "todos_parent_update" on todos
  for update using (family_id = current_family_id() and is_parent())
          with check (family_id = current_family_id() and is_parent());

create policy "todos_parent_delete" on todos
  for delete using (family_id = current_family_id() and is_parent());

-- members: 조회는 가족 전체, 쓰기는 부모만
-- (온보딩의 최초 members 생성은 아래 create_family() RPC가 RLS를 우회해서 처리한다)
drop policy if exists "members_own_family" on members;
drop policy if exists "members_select_family" on members;
drop policy if exists "members_parent_write" on members;

create policy "members_select_family" on members
  for select using (family_id = current_family_id());

create policy "members_parent_write" on members
  for all using (family_id = current_family_id() and is_parent())
      with check (family_id = current_family_id() and is_parent());

-- weekly_outfit_rules: 조회는 가족 전체, 쓰기는 부모만
drop policy if exists "weekly_outfit_rules_own_family" on weekly_outfit_rules;
drop policy if exists "weekly_outfit_rules_select_family" on weekly_outfit_rules;
drop policy if exists "weekly_outfit_rules_parent_write" on weekly_outfit_rules;

create policy "weekly_outfit_rules_select_family" on weekly_outfit_rules
  for select using (exists (
    select 1 from members m
    where m.member_id = weekly_outfit_rules.member_id
      and m.family_id = current_family_id()
  ));

create policy "weekly_outfit_rules_parent_write" on weekly_outfit_rules
  for all using (is_parent() and exists (
    select 1 from members m
    where m.member_id = weekly_outfit_rules.member_id
      and m.family_id = current_family_id()
  ))
  with check (is_parent() and exists (
    select 1 from members m
    where m.member_id = weekly_outfit_rules.member_id
      and m.family_id = current_family_id()
  ));

-- ============================================================================
-- 4. RPC
--    예상 가능한 실패(PIN 틀림/잠김/미설정)는 raise가 아니라 반환값으로 알린다.
--    raise하면 트랜잭션이 롤백되어 failed_attempts 증가까지 되돌아가고,
--    그러면 잠금이 영원히 걸리지 않아 4자리 PIN을 무제한 시도할 수 있게 된다.
-- ============================================================================

-- 가족 생성: 온보딩 전용. 한 트랜잭션에서 families + members를 만든다.
-- 이걸 RPC로 옮긴 이유
--   (a) 원자성 — 클라이언트에서 두 번 insert하면 members 실패 시 families가 고아로 남는다.
--   (b) members 쓰기 정책이 부모 전용이 되어, 최초 생성은 RLS 우회가 필요하다.
--   (c) families INSERT ... RETURNING이 SELECT 정책에 막히는 문제도 함께 사라진다.
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

  insert into families (family_id, name) values (v_family_id, trim(p_name));

  for v_m in select * from jsonb_array_elements(p_members) loop
    insert into members (family_id, name, role)
      values (v_family_id, trim(v_m ->> 'name'), v_m ->> 'role');
    v_count := v_count + 1;
  end loop;

  return json_build_object('ok', true, 'family_id', v_family_id, 'member_count', v_count);
end $$;

-- PIN 설정/변경. 최초 설정은 old_pin 없이 가능(부트스트랩), 변경은 기존 PIN 필요.
create or replace function set_parent_pin(p_member_id uuid, p_new_pin text, p_old_pin text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_existing parent_pins;
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

  if v_existing.member_id is not null then
    -- 변경: 기존 PIN 확인 필수
    if p_old_pin is null or v_existing.pin_hash <> crypt(p_old_pin, v_existing.pin_hash) then
      return json_build_object('ok', false, 'error', 'old_pin_mismatch');
    end if;
    update parent_pins
      set pin_hash = crypt(p_new_pin, gen_salt('bf')),
          failed_attempts = 0, locked_until = null, updated_at = now()
      where member_id = p_member_id;
    -- PIN이 바뀌면 기존 세션은 모두 무효화한다
    delete from parent_sessions where member_id = p_member_id;
    return json_build_object('ok', true, 'created', false);
  end if;

  insert into parent_pins (member_id, family_id, pin_hash)
    values (p_member_id, v_family, crypt(p_new_pin, gen_salt('bf')));
  return json_build_object('ok', true, 'created', true);
end $$;

-- 부모 로그인: PIN 검증 후 30일 토큰 발급. 5회 실패 시 15분 잠금.
create or replace function parent_login(p_member_id uuid, p_pin text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_rec parent_pins;
  v_token uuid;
  v_expires timestamptz := now() + interval '30 days';
begin
  if v_family is null then
    return json_build_object('ok', false, 'error', 'family_required');
  end if;
  if not exists (
    select 1 from members m
    where m.member_id = p_member_id and m.family_id = v_family and m.role = 'parent'
  ) then
    return json_build_object('ok', false, 'error', 'not_a_parent');
  end if;

  select * into v_rec from parent_pins where member_id = p_member_id;
  if v_rec.member_id is null then
    return json_build_object('ok', false, 'error', 'pin_not_set');
  end if;
  if v_rec.locked_until is not null and v_rec.locked_until > now() then
    return json_build_object('ok', false, 'error', 'locked', 'locked_until', v_rec.locked_until);
  end if;

  if v_rec.pin_hash <> crypt(p_pin, v_rec.pin_hash) then
    update parent_pins
      set failed_attempts = failed_attempts + 1,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
      where member_id = p_member_id;
    return json_build_object('ok', false, 'error', 'invalid_pin',
      'attempts_left', greatest(0, 5 - (v_rec.failed_attempts + 1)));
  end if;

  update parent_pins set failed_attempts = 0, locked_until = null where member_id = p_member_id;

  delete from parent_sessions where expires_at < now();
  insert into parent_sessions (member_id, family_id, expires_at)
    values (p_member_id, v_family, v_expires)
    returning token into v_token;

  return json_build_object('ok', true, 'token', v_token, 'member_id', p_member_id, 'expires_at', v_expires);
end $$;

create or replace function parent_logout() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from parent_sessions
    where token = current_parent_token() and family_id = current_family_id();
  return json_build_object('ok', true);
end $$;

-- 자녀 완료 토글: 자녀에게는 todos 직접 UPDATE 권한이 없으므로 이 경로만 열려 있다.
-- RLS가 행 단위라 열 단위 제한이 불가능한 문제를 이 함수로 우회한다
-- (자녀가 직접 UPDATE할 수 있으면 is_done만 바꾸도록 제한할 방법이 없어 제목·담당자도 바꿀 수 있다).
-- completed_by는 클라이언트가 보낸 값이 아니라 서버가 결정한다.
create or replace function toggle_my_todo(p_todo_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_actor uuid := acting_member_id();
  v_todo todos;
begin
  if v_family is null or v_actor is null then
    return json_build_object('ok', false, 'error', 'identity_required');
  end if;

  select * into v_todo from todos
    where todo_id = p_todo_id and family_id = v_family;
  if v_todo.todo_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  -- 부모는 아무 항목이나, 자녀는 자기 담당만
  if not is_parent() and v_todo.assignee_member_id is distinct from v_actor then
    return json_build_object('ok', false, 'error', 'not_your_todo');
  end if;

  update todos set
    is_done      = not v_todo.is_done,
    completed_by = case when not v_todo.is_done then v_actor else null end,
    completed_at = case when not v_todo.is_done then now() else null end
    where todo_id = p_todo_id
    returning * into v_todo;

  return json_build_object('ok', true, 'todo', row_to_json(v_todo));
end $$;

-- ============================================================================
-- 5. 실행 권한
-- ============================================================================
grant execute on function create_family(text, jsonb)             to anon, authenticated;
grant execute on function set_parent_pin(uuid, text, text)       to anon, authenticated;
grant execute on function parent_login(uuid, text)               to anon, authenticated;
grant execute on function parent_logout()                        to anon, authenticated;
grant execute on function toggle_my_todo(uuid)                   to anon, authenticated;

-- 정책 내부에서만 쓰이는 판정 함수도 호출 자체는 막지 않는다(값이 노출돼도 무해).
grant execute on function is_parent()                            to anon, authenticated;
grant execute on function current_family_id()                    to anon, authenticated;
grant execute on function current_member_id()                    to anon, authenticated;

-- parent_pins / parent_sessions 에는 정책이 없으므로 anon 직접 접근은 차단된다.
-- 혹시 모를 노출을 막기 위해 테이블 권한 자체도 회수한다.
revoke all on table parent_pins    from anon, authenticated;
revoke all on table parent_sessions from anon, authenticated;

notify pgrst, 'reload schema';
