-- migration_08 — 가족 포인트 보상 제도
--
-- 포인트만 쌓이고 쓸 데가 없으면 숫자를 늘리는 게임에 그친다. 가족이 직접 협의한
-- 보상("1만 포인트 외식", "10만 포인트 여행")을 목표로 걸어두고 진행률을 본다.
--
-- 보상은 가족마다 다르므로 공용 기본값을 두지 않는다 — 협의 내용이 곧 데이터다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists rewards (
  reward_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 60),
  required_points integer not null check (required_points between 1 and 10000000),
  note text,
  -- 달성해서 실제로 쓴 보상은 목록에서 내려간다. 지우지 않고 남기는 이유는
  -- "우리가 지난달에 외식 다녀왔다"는 기록 자체가 동기가 되기 때문이다.
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rewards_family_idx on rewards (family_id, required_points);

alter table rewards enable row level security;

drop policy if exists "rewards_select_family" on rewards;
drop policy if exists "rewards_parent_write" on rewards;

-- 아이도 목표를 봐야 동기가 된다. 다만 목표를 정하고 "달성 처리"하는 건 부모만 한다 —
-- 아이가 스스로 보상을 소진 처리할 수 있으면 협의가 아니라 선언이 된다.
create policy "rewards_select_family" on rewards
  for select using (family_id = current_family_id());

create policy "rewards_parent_write" on rewards
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());
