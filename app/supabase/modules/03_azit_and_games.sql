-- ==============================================================================
-- Kinship Module 3: Azit, Chat & Mini-Games (가족톡, 웹푸시, 미니게임 4종)
-- File: app/supabase/modules/03_azit_and_games.sql
-- ==============================================================================

-- 1. 테이블 정의

-- (1) 가족 채팅 메시지 (chat_messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL CHECK (length(btrim(sender_name)) BETWEEN 1 AND 40),
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 500),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (2) 게임 결과 테이블 (game_results)
CREATE TABLE IF NOT EXISTS game_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  game_key TEXT NOT NULL CHECK (game_key IN ('sum15', 'bingo', 'stairs', 'updown', 'wordchain', 'worldpuzzle')),
  winner_member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  opponent_member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (3) 원격 실시간 턴제 대전 세션 테이블 (game_sessions)
CREATE TABLE IF NOT EXISTS game_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  game_key TEXT NOT NULL CHECK (game_key IN ('sum15', 'bingo', 'stairs', 'updown', 'wordchain', 'worldpuzzle')),
  p1_member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  p2_member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  turn TEXT NOT NULL DEFAULT 'p1' CHECK (turn IN ('p1', 'p2')),
  winner TEXT CHECK (winner IN ('p1', 'p2', 'draw')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (4) 웹 푸시 구독 정보 (push_subscriptions)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS 정책 설정
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- chat_messages 정책
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT WITH CHECK (family_id = current_family_id());

DROP POLICY IF EXISTS "chat_messages_delete_parent" ON chat_messages;
CREATE POLICY "chat_messages_delete_parent" ON chat_messages FOR DELETE USING (family_id = current_family_id() AND is_parent());

-- game_results 정책 (자녀도 게임 후 점수 기록을 위해 INSERT 허용)
DROP POLICY IF EXISTS "game_results_select" ON game_results;
CREATE POLICY "game_results_select" ON game_results FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "game_results_insert" ON game_results;
CREATE POLICY "game_results_insert" ON game_results FOR INSERT WITH CHECK (family_id = current_family_id());

-- game_sessions 정책 (원격 대전 턴 교환 및 방 관리)
DROP POLICY IF EXISTS "game_sessions_select" ON game_sessions;
CREATE POLICY "game_sessions_select" ON game_sessions FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "game_sessions_insert" ON game_sessions;
CREATE POLICY "game_sessions_insert" ON game_sessions FOR INSERT WITH CHECK (family_id = current_family_id());

DROP POLICY IF EXISTS "game_sessions_update" ON game_sessions;
CREATE POLICY "game_sessions_update" ON game_sessions FOR UPDATE USING (family_id = current_family_id());

DROP POLICY IF EXISTS "game_sessions_delete" ON game_sessions;
CREATE POLICY "game_sessions_delete" ON game_sessions FOR DELETE USING (family_id = current_family_id());

-- push_subscriptions 정책
DROP POLICY IF EXISTS "push_subscriptions_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL USING (family_id = current_family_id()) WITH CHECK (family_id = current_family_id());

-- 3. 유지보수 함수
DROP FUNCTION IF EXISTS delete_old_chat_messages() CASCADE;
CREATE OR REPLACE FUNCTION delete_old_chat_messages()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_family ON chat_messages(family_id, created_at);
CREATE INDEX IF NOT EXISTS game_sessions_family_idx ON game_sessions(family_id, updated_at DESC);
