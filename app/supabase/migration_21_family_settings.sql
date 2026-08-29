-- migration_21 — 가족이 직접 정하는 설정값
--
-- 지금까지 코드에 박혀 있던 숫자들을 가족마다 정할 수 있게 꺼낸다.
--   할일 1개 = 10p / 아이 미션 하루 10개 / 가족톡 7일 보관
-- 아이 나이도 형제 수도 가족마다 달라서, 한 값이 모두에게 맞을 수가 없다.
--
-- 값은 가족당 한 행이다. 읽기는 가족 전체(아이도 "하루 몇 개까지"를 알아야 한다),
-- 쓰기는 부모만 — 아이가 자기 상한을 올릴 수 있으면 상한이 아니다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists family_settings (
  family_id uuid primary key references families (family_id) on delete cascade,

  -- 완료한 할일 하나가 주는 가족 포인트. 0으로 두면 할일은 포인트를 주지 않고
  -- 게임 점수만 쌓인다(할일을 점수와 떼어놓고 싶은 가족을 위해).
  todo_point integer not null default 10 check (todo_point between 0 and 100),

  -- 아이가 하루에 스스로 넣을 수 있는 미션 개수.
  mission_daily_limit integer not null default 10 check (mission_daily_limit between 1 and 30),

  -- 별을 부모 확인 뒤에만 줄지. false면 아이가 체크하는 순간 별이 된다.
  require_approval boolean not null default true,

  -- 밀린 할일을 며칠 뒤에 정리할지. 0이면 정리하지 않는다.
  --
  -- **완료한 할일은 절대 지우지 않는다.** 별과 가족 포인트가 "지금 완료 상태인 할일"
  -- 에서 계산되기 때문에, 완료한 것을 지우면 아이가 모은 별이 함께 사라진다.
  -- 정리 대상은 "마감일이 지났는데 아직 안 한 할일"뿐이다.
  todo_keep_days integer not null default 30 check (todo_keep_days between 0 and 365),

  -- 가족톡을 며칠 보관할지.
  chat_keep_days integer not null default 7 check (chat_keep_days between 1 and 90),

  updated_at timestamptz not null default now()
);

alter table family_settings enable row level security;

drop policy if exists "family_settings_select_family" on family_settings;
drop policy if exists "family_settings_parent_write" on family_settings;

create policy "family_settings_select_family" on family_settings
  for select using (family_id = current_family_id());

create policy "family_settings_parent_write" on family_settings
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());

-- 행이 없는 가족은 기본값으로 본다. 설정을 한 번도 안 건드린 가족을 위해
-- 미리 행을 만들어두지 않는 이유는, 가족을 만드는 create_family()를 또 고쳐야 하고
-- 기본값이 바뀌었을 때 "이미 만들어진 행"이 옛 값을 붙들기 때문이다.
create or replace function family_setting_int(p_key text, p_default integer)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_key
       when 'todo_point' then todo_point
       when 'mission_daily_limit' then mission_daily_limit
       when 'todo_keep_days' then todo_keep_days
       when 'chat_keep_days' then chat_keep_days
     end
     from family_settings where family_id = current_family_id()),
    p_default)
$$;

grant execute on function family_setting_int(text, integer) to anon, authenticated;

-- ============================================================================
-- add_my_todo — 하루 상한을 설정에서 읽는다
-- ============================================================================
create or replace function add_my_todo(p_title text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_actor  uuid := acting_member_id();
  v_title  text := btrim(coalesce(p_title, ''));
  v_today  date := app_today();
  v_limit  int  := family_setting_int('mission_daily_limit', 10);
  v_count  int;
  v_todo   todos;
begin
  if v_family is null or v_actor is null then
    return json_build_object('ok', false, 'error', 'identity_required');
  end if;
  if v_title = '' then
    return json_build_object('ok', false, 'error', 'empty_title');
  end if;
  if char_length(v_title) > 40 then
    return json_build_object('ok', false, 'error', 'too_long');
  end if;

  select count(*) into v_count from todos
    where family_id = v_family
      and assignee_member_id = v_actor
      and self_made
      and due_date = v_today;
  if v_count >= v_limit then
    return json_build_object('ok', false, 'error', 'daily_limit', 'limit', v_limit);
  end if;

  if exists (
    select 1 from todos
      where family_id = v_family
        and assignee_member_id = v_actor
        and due_date = v_today
        and lower(btrim(title)) = lower(v_title)
  ) then
    return json_build_object('ok', false, 'error', 'duplicate');
  end if;

  insert into todos (family_id, title, assignee_member_id, due_date, self_made)
    values (v_family, v_title, v_actor, v_today, true)
    returning * into v_todo;

  return json_build_object('ok', true, 'todo', row_to_json(v_todo));
end $$;

grant execute on function add_my_todo(text) to anon, authenticated;

-- ============================================================================
-- 밀린 할일 정리
-- ============================================================================
--
-- 앱을 열 때 클라이언트가 부른다. cron으로 돌리지 않는 이유는 설정이 가족마다 다르고,
-- pg_cron을 쓰면 "어디서 지워지는지" 저장소만 봐서는 알 수 없기 때문이다.
--
-- security definer인 이유: todos 삭제 정책이 부모 전용이라 아이 기기에서는 한 행도
-- 못 지운다. 그러면 아이만 쓰는 기기에서는 영영 정리가 안 된다. 대신 이 함수는
-- 조건을 안에 못박아 두어(내 가족 / 미완료 / 기한 지남) 임의 삭제로 쓸 수 없다.
create or replace function purge_old_todos()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_days   int  := family_setting_int('todo_keep_days', 30);
  v_deleted integer;
begin
  if v_family is null or v_days <= 0 then
    return 0;
  end if;

  delete from todos
   where family_id = v_family
     and not is_done
     and due_date < app_today() - v_days;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

grant execute on function purge_old_todos() to anon, authenticated;

-- ============================================================================
-- 가족톡 보관 기간 — 가족마다 다르게
-- ============================================================================
--
-- cron 작업에는 요청 헤더가 없어 current_family_id()가 null이다. 그래서 이 함수는
-- 가족을 가리지 않고 돌면서, 각 메시지가 속한 가족의 설정을 직접 찾아본다.
create or replace function delete_old_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from chat_messages c
  where c.created_at < now() - (
    coalesce((select s.chat_keep_days from family_settings s where s.family_id = c.family_id), 7)
    || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

revoke all on function delete_old_chat_messages() from public, anon, authenticated;
