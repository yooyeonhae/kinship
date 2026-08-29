-- migration_18 — "오늘의 할일" 기준 + 아이가 스스로 넣는 할일 + 별 저금통 보상
--
-- 고치는 문제 세 가지
--   1) todos에 날짜가 없어서 "오늘 할일"이라 부르면서 실제로는 그 아이의 할일 '전부'를
--      보여줬다. 어제 안 한 일이 오늘 그대로 남고 며칠이면 별 막대가 스무 칸이 된다.
--   2) 할일 추가가 부모 전용이라 아이는 자기가 할 일을 스스로 정할 수 없었다.
--   3) 보상(rewards)은 가족 포인트만 보고 있어서, 아이가 모은 별은 아무 데도 쓰이지 않았다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

-- ============================================================================
-- 1. todos: 언제까지 / 누가 만들었나
-- ============================================================================

-- 기본값을 current_date로 두면 지금까지처럼 "그냥 등록"해도 오늘 것이 된다.
-- 기존 행은 만든 날을 마감일로 본다 — 그게 그때 의도했던 '오늘'이다.
--
-- 칼럼을 처음부터 not null default로 만들지 않는 이유: 그러면 기존 행이 전부
-- '오늘'이 되어 버려서 "방금 넣은 것"과 "며칠 전 것"을 구분할 수 없고, 되돌리려면
-- 어느 행이 원래 오늘 것이었는지 알 수 없다. 비워서 넣고 → 채우고 → 조인다.
alter table todos add column if not exists due_date date;
update todos set due_date = created_at::date where due_date is null;
alter table todos alter column due_date set default current_date;
alter table todos alter column due_date set not null;

-- 아이가 스스로 만든 할일인지. 별도 칼럼으로 둔 이유는 가족 포인트 계산이
-- 이 값 하나만 보면 되기 때문이다(assignee의 role을 조인해 알아내면, 나중에
-- 부모가 자기 자신에게 준 할일까지 같이 걸린다 — 그건 아이가 만든 게 아니다).
--
-- 왜 구분하나: 완료한 할일 하나가 가족 포인트 10p인데 아이가 할일을 무한히 만들 수
-- 있으면 "물 마시기" 스무 개로 200p를 만들 수 있다. 아이가 만든 할일은 **별만** 주고
-- 가족 포인트는 주지 않는다. 자율성은 살리고 점수 부풀리기는 막는다.
alter table todos add column if not exists self_made boolean not null default false;

create index if not exists todos_due_idx on todos (family_id, due_date);

-- ============================================================================
-- 2. rewards: 가족 목표 / 아이 별 목표
-- ============================================================================

-- member_id가 null이면 지금까지처럼 가족 포인트로 이루는 공동 목표,
-- 값이 있으면 그 아이가 모은 '별'로 이루는 개인 목표다.
-- required_points는 두 경우에 각각 포인트 / 별 개수로 읽힌다.
alter table rewards add column if not exists member_id uuid references members (member_id) on delete cascade;

-- ============================================================================
-- 3. 아이가 자기 할일을 넣고 지우는 RPC
-- ============================================================================
--
-- 직접 INSERT를 열지 않는 이유는 toggle_my_todo와 같다: RLS는 행 단위라
-- "assignee는 반드시 자기 자신"을 강제할 수 없어서, 정책을 열면 아이가 남에게
-- 할일을 떠넘길 수 있다. 담당자·self_made·마감일을 **서버가** 정한다.

-- 하루에 넣을 수 있는 개수. 없으면 아이가 별을 모으려고 할일을 수십 개 만들 수 있고,
-- 그러면 별의 의미가 사라진다. 열 개는 "오늘 할 일"로 충분히 넉넉하다.
create or replace function add_my_todo(p_title text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_actor  uuid := acting_member_id();
  v_title  text := btrim(coalesce(p_title, ''));
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
      and due_date = current_date;
  if v_count >= 10 then
    return json_build_object('ok', false, 'error', 'daily_limit');
  end if;

  -- 같은 날 같은 제목을 두 번 넣으면 별만 두 배가 된다
  if exists (
    select 1 from todos
      where family_id = v_family
        and assignee_member_id = v_actor
        and due_date = current_date
        and lower(btrim(title)) = lower(v_title)
  ) then
    return json_build_object('ok', false, 'error', 'duplicate');
  end if;

  insert into todos (family_id, title, assignee_member_id, due_date, self_made)
    values (v_family, v_title, v_actor, current_date, true)
    returning * into v_todo;

  return json_build_object('ok', true, 'todo', row_to_json(v_todo));
end $$;

-- 잘못 넣은 것을 아이가 스스로 지운다. **자기가 만든 것만** — 부모가 준 할일을
-- 지우는 길이 되면 "하기 싫으면 지운다"가 되어 버린다.
create or replace function delete_my_todo(p_todo_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_family uuid := current_family_id();
  v_actor  uuid := acting_member_id();
  v_todo   todos;
begin
  if v_family is null or v_actor is null then
    return json_build_object('ok', false, 'error', 'identity_required');
  end if;

  select * into v_todo from todos
    where todo_id = p_todo_id and family_id = v_family;
  if v_todo.todo_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if not v_todo.self_made or v_todo.assignee_member_id is distinct from v_actor then
    return json_build_object('ok', false, 'error', 'not_your_todo');
  end if;

  delete from todos where todo_id = p_todo_id;
  return json_build_object('ok', true);
end $$;

grant execute on function add_my_todo(text)    to anon, authenticated;
grant execute on function delete_my_todo(uuid) to anon, authenticated;
