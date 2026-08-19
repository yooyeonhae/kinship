-- migration_09 — 아이들 할일 요일별 스케줄
--
-- todos는 "오늘 해야 할 일" 하나하나를 담는 표라 요일 개념이 없다. 매주 화요일 피아노,
-- 매주 목요일 태권도처럼 되풀이되는 일정은 매주 손으로 다시 넣어야 했다.
-- weekly_outfit_rules가 요일별 지정복을 담는 것과 같은 자리에, 요일별 일정을 담는다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists schedules (
  schedule_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  member_id uuid not null references members (member_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 60),

  -- 'weekly' = 매주 그 요일마다, 'once' = 그 날짜 하루만
  repeat_type text not null check (repeat_type in ('weekly', 'once')),
  -- weekly_outfit_rules의 day_of_week와 같은 값을 쓴다
  day_of_week text check (day_of_week in ('월', '화', '수', '목', '금', '토', '일')),
  schedule_date date,

  start_time time not null,
  -- 몇 분 전에 알릴지. null이면 알림 없음.
  alarm_minutes integer check (alarm_minutes is null or alarm_minutes between 0 and 1440),

  created_at timestamptz not null default now(),

  -- 반복이면 요일이, 하루짜리면 날짜가 있어야 한다. 둘 다 비면 언제인지 알 수 없고,
  -- 둘 다 차 있으면 어느 쪽을 따라야 하는지 알 수 없다.
  constraint schedules_when_check check (
    (repeat_type = 'weekly' and day_of_week is not null and schedule_date is null)
    or (repeat_type = 'once' and schedule_date is not null and day_of_week is null)
  )
);

create index if not exists schedules_family_member_idx on schedules (family_id, member_id);

alter table schedules enable row level security;

drop policy if exists "schedules_select_family" on schedules;
drop policy if exists "schedules_parent_write" on schedules;

-- 아이는 자기 일정을 봐야 하므로 조회는 가족 전체.
-- 등록·수정·삭제는 부모만 — todos·weekly_outfit_rules와 같은 규칙이다.
create policy "schedules_select_family" on schedules
  for select using (family_id = current_family_id());

create policy "schedules_parent_write" on schedules
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());
