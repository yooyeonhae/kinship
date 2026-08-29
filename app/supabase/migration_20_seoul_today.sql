-- migration_20 — "오늘"을 서울 날짜로 맞춘다 (시간대 버그 수정)
--
-- 증상: 아이가 '나의 미션'을 추가하면 그 항목이 "며칠 전 못 한 일"로 들어갔다.
--
-- 원인: Supabase의 Postgres는 UTC로 돈다. `current_date`가 UTC 날짜라서,
-- 한국 시간 00:00~09:00 사이에는 서버의 오늘이 화면의 오늘보다 하루 이르다.
--   예) KST 2026-08-25 01:56 = UTC 2026-08-24 16:56
--       → add_my_todo가 due_date = 2026-08-24로 넣고,
--         화면의 todayValue()는 2026-08-25 → "오늘이 아닌, 지난 날의 미완료" = 지난 일
--
-- 하필 이 앱이 가장 많이 쓰이는 시간(아침 등교 준비)이 그 창에 들어간다.
--
-- 고치는 방법: 날짜를 만드는 곳을 모두 서울 기준 함수 하나로 모은다. 데이터베이스
-- 전체 timezone을 바꾸지 않는 이유는 created_at 같은 timestamptz의 의미까지 흔들리고,
-- 되돌릴 때 어디가 영향받았는지 알기 어려워서다. 날짜(date)만 서울로 고정한다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

-- 이 앱의 사용자는 한 나라에 산다(가족 단위 앱). 그래서 서울을 상수로 둔다 —
-- 가족마다 시간대를 두려면 families에 칼럼을 추가해야 하고, 그건 지금 필요가 없다.
create or replace function app_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

grant execute on function app_today() to anon, authenticated;

alter table todos alter column due_date set default app_today();

-- 이미 잘못 들어간 행 되돌리기.
-- self_made(아이가 넣은 것)는 "넣은 날 = 마감일"이 정의라서, 만든 시각의 서울 날짜로
-- 정확히 복원할 수 있다. 부모가 준 할일은 손대지 않는다 — 내일 준비물처럼 일부러
-- 다른 날짜를 넣은 것일 수 있고, 그건 추측해서 고칠 값이 아니다.
update todos
  set due_date = (created_at at time zone 'Asia/Seoul')::date
  where self_made
    and due_date <> (created_at at time zone 'Asia/Seoul')::date;

-- add_my_todo 재정의 — 하루 상한·중복 검사·마감일 모두 서울 날짜 기준.
-- 상한 검사만 UTC로 남겨두면 자정 무렵에 하루가 두 번 겹쳐 20개까지 들어간다.
create or replace function add_my_todo(p_title text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_actor  uuid := acting_member_id();
  v_title  text := btrim(coalesce(p_title, ''));
  v_today  date := app_today();
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
  if v_count >= 10 then
    return json_build_object('ok', false, 'error', 'daily_limit');
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

-- 확인용 — 실행 후 두 값이 같아야 한다(한국 시간 기준 오늘).
-- select current_date as utc_today, app_today() as seoul_today;
