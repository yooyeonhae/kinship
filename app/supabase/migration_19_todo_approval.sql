-- migration_19 — 부모의 확인 도장 (별 합산의 조건)
--
-- 아이가 할일을 체크하면 "확인 기다림"이고, 부모가 도장을 찍은 순간 그 할일이 아이의
-- 별로 합산된다. 체크는 아이가 혼자 누르는 것이라 실제로 했는지는 아이만 안다 —
-- 별이 보상으로 바뀌는 값이라면 확인하는 사람이 있어야 하고, 그 확인 자체가 "봤다"는
-- 신호가 되어 아이에게 전해진다.
--
-- (처음 설계는 '도장 = 별 2배'였는데, 승인을 합산 조건으로 두면 미승인이 0이라
--  배수의 기준이 사라져서 2배라는 말이 아무것도 뜻하지 않게 된다. 도장 하나로 합쳤다.)
--
-- 스트릭(연속 달성)은 이 파일에 없다. 며칠 연속 다 했는지는 due_date와 is_done만
-- 있으면 계산할 수 있어서, 따로 저장하면 두 값이 어긋날 수 있다(달성 기록을 쌓아두면
-- 나중에 할일을 지웠을 때 기록만 남는다). 화면에서 매번 계산한다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table todos add column if not exists approved_by uuid references members (member_id) on delete set null;
alter table todos add column if not exists approved_at timestamptz;

-- 도장은 부모만, 그리고 '끝난 할일'에만. 완료 전에 미리 찍을 수 있으면 확인이
-- 아니라 예약이 되어, 하지 않은 일에 별이 붙는다.
--
-- todos UPDATE 정책이 이미 부모 전용이라 직접 update로도 되지만, 그러면 approved_by를
-- 클라이언트가 정하게 된다. completed_by를 서버가 정하는 것과 같은 이유로 RPC를 쓴다.
create or replace function approve_todo(p_todo_id uuid)
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
  if not is_parent() then
    return json_build_object('ok', false, 'error', 'parent_only');
  end if;

  select * into v_todo from todos
    where todo_id = p_todo_id and family_id = v_family;
  if v_todo.todo_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if not v_todo.is_done then
    return json_build_object('ok', false, 'error', 'not_done');
  end if;

  -- 한 번 더 누르면 도장을 뗀다. 잘못 찍었을 때 되돌릴 길이 없으면 안 된다.
  update todos set
    approved_by = case when v_todo.approved_by is null then v_actor else null end,
    approved_at = case when v_todo.approved_by is null then now() else null end
    where todo_id = p_todo_id
    returning * into v_todo;

  return json_build_object('ok', true, 'todo', row_to_json(v_todo));
end $$;

grant execute on function approve_todo(uuid) to anon, authenticated;

-- toggle_my_todo 재정의 — 완료를 풀면 도장도 함께 떨어진다.
-- 안 떨어뜨리면 "체크를 풀었다가 다시 누르면 도장이 그대로 살아 있는" 상태가 되어,
-- 부모가 보지 않은 일에 별이 붙는다. 다시 하면 다시 확인받는 게 맞다.
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
    completed_at = case when not v_todo.is_done then now() else null end,
    approved_by  = case when not v_todo.is_done then v_todo.approved_by else null end,
    approved_at  = case when not v_todo.is_done then v_todo.approved_at else null end
    where todo_id = p_todo_id
    returning * into v_todo;

  return json_build_object('ok', true, 'todo', row_to_json(v_todo));
end $$;

grant execute on function toggle_my_todo(uuid) to anon, authenticated;
