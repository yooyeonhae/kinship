-- migration_13 — "자주 쓰는 항목"을 가족이 직접 고치게 한다
--
-- 지금은 화면에 박힌 세 개('우유 사기', '쓰레기 버리기', '준비물 확인')가 전부라,
-- 그 집에서 실제로 자주 하는 일과 다르면 아무 쓸모가 없다. 원탭 등록은 PRD의
-- Must 기능(3번, "적는 행위 자체의 번거로움")인데, 항목이 남의 집 것이면 탭 한 번이
-- 아니라 결국 직접 입력이 된다.
--
-- localStorage가 아니라 테이블에 두는 이유: 부모 두 사람이 서로 다른 기기를 쓰고,
-- 한쪽이 고친 항목이 다른 쪽에 보이지 않으면 "자주 쓰는 항목"이 사람마다 달라진다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists quick_tasks (
  quick_task_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 40),
  -- 화면에 놓이는 순서. 자주 쓰는 것을 앞으로 끌어올 수 있어야 한다.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quick_tasks_family_idx on quick_tasks (family_id, sort_order, created_at);

alter table quick_tasks enable row level security;

drop policy if exists "quick_tasks_select_family" on quick_tasks;
drop policy if exists "quick_tasks_parent_write" on quick_tasks;

-- 조회는 가족 전체(자녀 화면에서 쓰지 않더라도 막을 이유가 없다),
-- 쓰기는 부모만 — todos 등록이 부모 전용인데 그 지름길만 열어두면 규칙이 새어 나간다.
create policy "quick_tasks_select_family" on quick_tasks
  for select using (family_id = current_family_id());

create policy "quick_tasks_parent_write" on quick_tasks
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());

-- 기존 가족에는 지금까지 화면에 있던 세 개를 그대로 넣어준다.
-- 이걸 안 하면 마이그레이션 직후 칩이 통째로 사라져 기능이 없어진 것처럼 보인다.
insert into quick_tasks (family_id, title, sort_order)
select f.family_id, seed.title, seed.ord
from families f
cross join (values ('우유 사기', 0), ('쓰레기 버리기', 1), ('준비물 확인', 2)) as seed(title, ord)
where not exists (
  select 1 from quick_tasks q where q.family_id = f.family_id
);
