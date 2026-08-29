-- migration_22 — 설정 네 가지 추가 + 가족 이름 수정 권한 조이기
--
--   1) 가족 이름 바꾸기   — 지금은 아이도 바꿀 수 있다(정책이 가족 범위만 본다)
--   2) 기본 지역          — 날씨와 주말 나들이가 각자 고르던 것을 한 번만 정하게
--   3) 지난 일 표시 기간  — 아이 화면에 며칠 전 것까지 보여줄지
--   4) 주말 미션 상한     — 학교 안 가는 날은 더 넣을 수 있게
--
-- Dashboard의 SQL Editor에서 실행할 것.

-- ============================================================================
-- 1. families 수정은 부모만
-- ============================================================================
--
-- policies.sql의 families_update_own은 family_id만 본다. migration_02에서 todos·members를
-- 부모 전용으로 조일 때 families는 손대지 않았는데, 이름을 바꾸는 화면이 없어서
-- 드러나지 않았을 뿐이다. 설정에서 이름을 바꿀 수 있게 되는 지금 같이 조인다.
drop policy if exists "families_update_own" on families;

create policy "families_update_parent" on families
  for update
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());

-- ============================================================================
-- 2. 설정 칼럼 추가
-- ============================================================================

-- 날씨(OpenWeatherMap)와 주말 나들이(관광공사)가 함께 쓰는 시/도 이름.
-- 두 API가 같은 한글 시/도 이름을 받으므로 값 하나로 충분하다.
-- 자유 문자열로 두는 이유: 시/도 목록이 늘거나 이름이 바뀔 때 CHECK까지 고쳐야 하면
-- 화면과 DB가 어긋나기 쉽고, 이 값은 잘못 들어가도 "결과가 안 나온다"로 끝난다.
alter table family_settings add column if not exists default_region text not null default '서울';

-- 아이 화면에서 "며칠 전 못 한 일"을 얼마나 거슬러 보여줄지.
alter table family_settings add column if not exists overdue_days integer not null default 7
  check (overdue_days between 1 and 30);

-- 토·일에 아이가 스스로 넣을 수 있는 미션 개수. 평일 상한과 따로 둔다 —
-- 학교에 안 가는 날은 스스로 할 일이 더 많은 게 자연스럽다.
alter table family_settings add column if not exists mission_weekend_limit integer not null default 15
  check (mission_weekend_limit between 1 and 30);

-- ============================================================================
-- 3. 설정 조회 함수에 새 키 추가
-- ============================================================================
create or replace function family_setting_int(p_key text, p_default integer)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_key
       when 'todo_point' then todo_point
       when 'mission_daily_limit' then mission_daily_limit
       when 'mission_weekend_limit' then mission_weekend_limit
       when 'todo_keep_days' then todo_keep_days
       when 'chat_keep_days' then chat_keep_days
       when 'overdue_days' then overdue_days
     end
     from family_settings where family_id = current_family_id()),
    p_default)
$$;

grant execute on function family_setting_int(text, integer) to anon, authenticated;

-- ============================================================================
-- 4. add_my_todo — 주말이면 주말 상한을 쓴다
-- ============================================================================
--
-- 요일 판정도 서울 기준이어야 한다. UTC로 보면 한국의 토요일 아침이 아직 금요일이라,
-- 주말 상한이 하루 늦게 열린다(migration_20과 같은 함정).
create or replace function add_my_todo(p_title text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family  uuid := current_family_id();
  v_actor   uuid := acting_member_id();
  v_title   text := btrim(coalesce(p_title, ''));
  v_today   date := app_today();
  v_weekend boolean := extract(isodow from app_today()) in (6, 7);
  v_limit   int;
  v_count   int;
  v_todo    todos;
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

  v_limit := case
    when v_weekend then family_setting_int('mission_weekend_limit', 15)
    else family_setting_int('mission_daily_limit', 10)
  end;

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

-- 확인용 — 오늘이 주말로 잡히는지(6=토, 7=일)
-- select app_today(), extract(isodow from app_today()) as isodow;
