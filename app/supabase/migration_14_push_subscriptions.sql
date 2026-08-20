-- migration_14 — 웹 푸시 구독 정보
--
-- 아지트 채팅이 오면 휴대폰 알림창에 뜨게 하려면, 각 기기가 브라우저에서 발급받은
-- 구독 주소(endpoint)를 서버가 알고 있어야 한다. 그래야 앱을 닫아둔 사람에게도
-- 보낼 수 있다 — Notification API만으로는 앱이 열려 있을 때밖에 못 띄운다.
--
-- 저장하는 값은 브라우저가 준 것 그대로다:
--   endpoint  푸시 서비스(FCM 등)의 이 기기 전용 주소
--   p256dh    본문을 암호화할 공개키
--   auth      인증 비밀값
-- 이 세 개를 가진 사람은 그 기기에 알림을 보낼 수 있다. 그래서 select도 가족 범위로
-- 묶어두지만, 이 앱 전체가 family_id를 아는 사람을 가족으로 보는 구조라는 점은 같다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists push_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  member_id uuid not null references members (member_id) on delete cascade,
  -- 같은 기기가 다시 구독하면 새 행을 쌓지 않고 덮어쓴다. 안 그러면 알림이 여러 번 온다.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_family_idx on push_subscriptions (family_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_family" on push_subscriptions;
drop policy if exists "push_subscriptions_write_family" on push_subscriptions;

create policy "push_subscriptions_select_family" on push_subscriptions
  for select using (family_id = current_family_id());

-- 자녀도 자기 기기에서 알림을 켜야 하므로 쓰기를 부모로 좁히지 않는다.
-- 이건 "가족 데이터를 바꾸는 일"이 아니라 "내 기기를 등록하는 일"이다.
create policy "push_subscriptions_write_family" on push_subscriptions
  for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());
