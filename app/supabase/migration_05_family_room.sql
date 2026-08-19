-- migration_05 — 가족 아지트(채팅 + 미니게임)를 실제 데이터로 옮긴다
--
-- 지금까지 아지트는 화면 안 useState가 전부였다. 새로고침하면 대화가 사라지고,
-- "가족 포인트: 1,250p"는 마크업에 박아둔 고정 문자열이었다(screens/family-room.html에
-- "장식 — 연동된 점수 시스템 없음"이라는 주석이 그대로 남아 있다).
--
-- Dashboard의 SQL Editor에서 실행할 것.

-- 1) 채팅 -------------------------------------------------------------------
create table if not exists chat_messages (
  message_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  -- 구성원이 삭제돼도 지난 대화에 "누가 말했는지"는 남아야 하므로 이름을 함께 박아둔다.
  -- member_id만 두면 on delete set null 이후 발신자가 통째로 사라진다.
  member_id uuid references members (member_id) on delete set null,
  sender_name text not null check (length(btrim(sender_name)) between 1 and 40),
  content text not null check (length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_family_created_idx
  on chat_messages (family_id, created_at);

alter table chat_messages enable row level security;

-- 채팅은 자녀도 보내야 하므로 INSERT를 부모로 좁히지 않는다.
-- 다만 남의 말을 지우거나 고치는 건 부모만 할 수 있다.
drop policy if exists "chat_messages_select_family" on chat_messages;
drop policy if exists "chat_messages_insert_family" on chat_messages;
drop policy if exists "chat_messages_parent_delete" on chat_messages;

create policy "chat_messages_select_family" on chat_messages
  for select using (family_id = current_family_id());

create policy "chat_messages_insert_family" on chat_messages
  for insert with check (family_id = current_family_id());

create policy "chat_messages_parent_delete" on chat_messages
  for delete using (family_id = current_family_id() and is_parent());

-- 2) 게임 결과 = 가족 포인트의 근거 -----------------------------------------
create table if not exists game_results (
  result_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  game_key text not null check (game_key in ('sum15', 'bingo', 'stairs')),
  winner_member_id uuid references members (member_id) on delete set null,
  opponent_member_id uuid references members (member_id) on delete set null,
  is_draw boolean not null default false,
  -- 포인트를 클라이언트가 정하면 숫자를 마음대로 올려 보낼 수 있다. RLS는 열 단위
  -- 제한을 못 하므로 CHECK로 값 자체를 못박는다: 승리 10p, 무승부 5p.
  points integer not null,
  created_at timestamptz not null default now(),
  constraint game_results_points_check
    check ((is_draw and points = 5) or (not is_draw and points = 10)),
  -- 무승부에는 승자가 없어야 하고, 승부가 났으면 승자가 있어야 한다
  constraint game_results_winner_check
    check ((is_draw and winner_member_id is null) or (not is_draw and winner_member_id is not null))
);

create index if not exists game_results_family_created_idx
  on game_results (family_id, created_at);

alter table game_results enable row level security;

drop policy if exists "game_results_select_family" on game_results;
drop policy if exists "game_results_insert_family" on game_results;
drop policy if exists "game_results_parent_delete" on game_results;

create policy "game_results_select_family" on game_results
  for select using (family_id = current_family_id());

-- 게임은 아이들이 한다. 여기까지 부모 전용으로 막으면 점수가 아예 쌓이지 않는다.
create policy "game_results_insert_family" on game_results
  for insert with check (family_id = current_family_id());

create policy "game_results_parent_delete" on game_results
  for delete using (family_id = current_family_id() and is_parent());

-- 3) 왜 Realtime Postgres Changes를 쓰지 않는가 ------------------------------
-- 이 앱의 신원은 PostgREST 요청 헤더(x-family-id)에만 실린다. Realtime의
-- postgres_changes는 웹소켓 연결의 JWT로 RLS를 평가하므로 그 헤더가 존재하지 않고,
-- current_family_id()가 null이 되어 어떤 행도 전달되지 않는다. 그래서 화면은
-- "테이블에 INSERT(PostgREST) + 같은 내용을 Broadcast로 알림" 조합을 쓴다.
-- PRD 3.8이 지정한 Broadcast/Presence와도 일치한다. 이 테이블들을
-- supabase_realtime 퍼블리케이션에 넣을 필요는 없다.
