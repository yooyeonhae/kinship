-- migration_16 — 원격 턴제 대전
--
-- 지금까지 미니게임은 한 기기에서 선수1·선수2를 골라 번갈아 누르는 핫시트 방식이었다.
-- 떨어져 있는 가족끼리 하려면 판이 두 기기에 같이 있어야 한다. 그 판을 담는 표다.
--
-- state를 jsonb 한 칸에 통째로 넣는 이유: 게임마다 판 모양이 다르고(숫자 소유권, 빙고
-- 보드 두 개, 계단 점수, 업다운 범위), 서버는 그 안을 들여다볼 일이 없다. 규칙은 화면이
-- 갖고 있고 DB는 "지금 판이 이렇다"만 나른다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

create table if not exists game_sessions (
  session_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  game_key text not null check (game_key in ('sum15', 'bingo', 'stairs', 'updown')),

  p1_member_id uuid not null references members (member_id) on delete cascade,
  -- 방을 만든 직후에는 상대가 없다. 참가하면 채워진다.
  p2_member_id uuid references members (member_id) on delete cascade,

  state jsonb not null,
  turn text not null default 'p1' check (turn in ('p1', 'p2')),
  winner text check (winner in ('p1', 'p2', 'draw')),

  -- 끝난 판과 버려진 방을 구분해 목록에서 치우기 위해 쓴다
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_family_idx on game_sessions (family_id, updated_at desc);

alter table game_sessions enable row level security;

drop policy if exists "game_sessions_select_family" on game_sessions;
drop policy if exists "game_sessions_write_family" on game_sessions;

-- 게임은 아이들이 한다. 부모 전용으로 막으면 아무도 못 논다.
create policy "game_sessions_select_family" on game_sessions
  for select using (family_id = current_family_id());

create policy "game_sessions_write_family" on game_sessions
  for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

-- 차례를 서버가 강제하지 못한다는 점은 분명히 해둔다.
-- RLS는 행 단위라 "지금 turn인 사람만 state를 바꿀 수 있다"를 표현할 수 없고,
-- x-member-id는 자기신고값이라 acting_member_id()로 막아도 자녀가 상대 id를 넣으면 통과한다.
-- 즉 이 기능이 보장하는 건 "떨어져서 같이 둘 수 있다"까지이고,
-- "상대가 내 차례에 못 두게 막는다"는 화면 수준의 약속이다.
-- 형제간 장난을 막는 수준의 보장은 진짜 사용자 인증이 있어야 가능하다.
