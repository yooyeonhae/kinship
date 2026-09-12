-- ==============================================================================
-- Kinship (우리가족 올인원 스마트 패밀리 플래너) Master Consolidated Schema
-- File: full_schema.sql
-- Version: 2.2 (100% Robust Migration & Fresh Install Compatible)
-- Description:
--   단 하나의 SQL 파일로 Supabase 데이터베이스의 모든 테이블, RLS 보안 정책,
--   부모 PIN 보안 함수(RPC), 서울 시간 헬퍼, 인덱스, 50선 대표 메뉴 및
--   기본 레시피 시드 데이터를 완벽하게 생성/초기화합니다.
--
-- Execution:
--   Supabase Dashboard → SQL Editor에 붙여넣고 Run을 실행하세요.
-- ==============================================================================

-- 0. 필수 확장 모듈 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. 기존 함수 정리 (타입 충돌 방지용 DROP FUNCTION CASCADE)
-- ==============================================================================
DROP FUNCTION IF EXISTS safe_uuid(TEXT) CASCADE;
DROP FUNCTION IF EXISTS request_header(TEXT) CASCADE;
DROP FUNCTION IF EXISTS current_family_id() CASCADE;
DROP FUNCTION IF EXISTS current_member_id() CASCADE;
DROP FUNCTION IF EXISTS current_parent_token() CASCADE;
DROP FUNCTION IF EXISTS token_parent_id() CASCADE;
DROP FUNCTION IF EXISTS is_parent() CASCADE;
DROP FUNCTION IF EXISTS acting_member_id() CASCADE;
DROP FUNCTION IF EXISTS seoul_today() CASCADE;
DROP FUNCTION IF EXISTS app_today() CASCADE;
DROP FUNCTION IF EXISTS create_family(TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS set_parent_pin(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_parent_pin(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS parent_login(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS parent_logout() CASCADE;
DROP FUNCTION IF EXISTS toggle_my_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS approve_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS add_my_todo(TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_my_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS family_setting_int(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS purge_old_todos() CASCADE;
DROP FUNCTION IF EXISTS delete_old_chat_messages() CASCADE;

-- ==============================================================================
-- 2. 헤더 파싱 및 역할/인증 헬퍼 함수
-- ==============================================================================

CREATE OR REPLACE FUNCTION safe_uuid(p TEXT) RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN p::uuid
    ELSE null
  END
$$;

CREATE OR REPLACE FUNCTION request_header(p_name TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.headers', true)::json ->> p_name, '')
$$;

CREATE OR REPLACE FUNCTION current_family_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT safe_uuid(request_header('x-family-id'))
$$;

CREATE OR REPLACE FUNCTION current_member_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT safe_uuid(request_header('x-member-id'))
$$;

CREATE OR REPLACE FUNCTION current_parent_token() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT safe_uuid(request_header('x-parent-token'))
$$;

CREATE OR REPLACE FUNCTION seoul_today() RETURNS DATE
LANGUAGE sql IMMUTABLE AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
$$;

CREATE OR REPLACE FUNCTION app_today() RETURNS DATE
LANGUAGE sql IMMUTABLE AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
$$;

-- ==============================================================================
-- 3. 핵심 테이블 정의
-- ==============================================================================

-- (1) 가족 테이블 (families)
CREATE TABLE IF NOT EXISTS families (
  family_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (2) 가족 구성원 테이블 (members)
CREATE TABLE IF NOT EXISTS members (
  member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  avatar_url TEXT,
  color TEXT DEFAULT '#3b82f6',
  stars INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 members 테이블 업그레이드 보장
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
ALTER TABLE members ADD COLUMN IF NOT EXISTS stars INT NOT NULL DEFAULT 0;

-- (3) 부모 PIN 보안 테이블 (parent_pins)
CREATE TABLE IF NOT EXISTS parent_pins (
  member_id UUID PRIMARY KEY REFERENCES members (member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (4) 부모 인증 세션 테이블 (parent_sessions)
CREATE TABLE IF NOT EXISTS parent_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- (5) 등교 룩북 요일별 규칙 테이블 (weekly_outfit_rules)
CREATE TABLE IF NOT EXISTS weekly_outfit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('월', '화', '수', '목', '금', '토', '일')),
  outfit_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, day_of_week)
);

-- (6) 등교 룩북 옷장 아이템 (wardrobe_items)
CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (7) 오늘의 할 일 테이블 (todos)
CREATE TABLE IF NOT EXISTS todos (
  todo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES members (member_id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  due_date DATE DEFAULT seoul_today(),
  star_points INT NOT NULL DEFAULT 1,
  recurrence TEXT DEFAULT 'none',
  self_made BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT DEFAULT 'approved',
  approved_by UUID REFERENCES members (member_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 todos 테이블 업그레이드 보장
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT seoul_today();
ALTER TABLE todos ADD COLUMN IF NOT EXISTS star_points INT NOT NULL DEFAULT 1;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS self_made BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES members (member_id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- (8) 퀵 태스크 템플릿 (quick_tasks)
CREATE TABLE IF NOT EXISTS quick_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  star_reward INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (9) 보상 및 리워드 상점 (rewards)
CREATE TABLE IF NOT EXISTS rewards (
  reward_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  star_cost INT NOT NULL DEFAULT 10,
  icon TEXT DEFAULT '🎁',
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_by UUID REFERENCES members (member_id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (10) 가족 공유 캘린더 일정 (schedules)
CREATE TABLE IF NOT EXISTS schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  repeat_type TEXT NOT NULL DEFAULT 'once' CHECK (repeat_type IN ('weekly', 'once')),
  day_of_week TEXT CHECK (day_of_week IN ('월', '화', '수', '목', '금', '토', '일')),
  schedule_date DATE,
  start_time TIME NOT NULL DEFAULT '09:00',
  alarm_minutes INTEGER CHECK (alarm_minutes IS NULL OR alarm_minutes BETWEEN 0 AND 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 schedules 테이블 업그레이드 보장
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS repeat_type TEXT NOT NULL DEFAULT 'once';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS day_of_week TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS schedule_date DATE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '09:00';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS alarm_minutes INTEGER;

-- (11) 가족 레시피 (recipes)
CREATE TABLE IF NOT EXISTS recipes (
  recipe_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  steps TEXT,
  cook_minutes INT DEFAULT 20,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 recipes 테이블 업그레이드 보장
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS steps TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_minutes INT DEFAULT 20;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- (12) 즐겨찾기 링크 (favorite_links)
CREATE TABLE IF NOT EXISTS favorite_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  platform TEXT NOT NULL CHECK (platform IN ('유튜브', '쇼츠', '인스타', '기타')),
  url TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE favorite_links ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE favorite_links ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
ALTER TABLE favorite_links ADD COLUMN IF NOT EXISTS link_type TEXT NOT NULL DEFAULT 'video';
ALTER TABLE favorite_links ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- (13) 가족 채팅 메시지 (chat_messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL CHECK (length(btrim(sender_name)) BETWEEN 1 AND 40),
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 500),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (14) 게임 결과 테이블 (game_results)
CREATE TABLE IF NOT EXISTS game_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  game_key TEXT NOT NULL CHECK (game_key IN ('sum15', 'bingo', 'stairs', 'updown', 'wordchain')),
  winner_member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  opponent_member_id UUID REFERENCES members (member_id) ON DELETE SET NULL,
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (14-1) 원격 실시간 턴제 대전 세션 테이블 (game_sessions)
CREATE TABLE IF NOT EXISTS game_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  game_key TEXT NOT NULL CHECK (game_key IN ('sum15', 'bingo', 'stairs', 'updown', 'wordchain')),
  p1_member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  p2_member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  turn TEXT NOT NULL DEFAULT 'p1' CHECK (turn IN ('p1', 'p2')),
  winner TEXT CHECK (winner IN ('p1', 'p2', 'draw')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_sessions_family_idx ON game_sessions (family_id, updated_at DESC);

-- (15) 웹 푸시 구독 정보 (push_subscriptions)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, member_id)
);

-- (16) 가족 맞춤 설정 테이블 (family_settings)
CREATE TABLE IF NOT EXISTS family_settings (
  family_id UUID PRIMARY KEY REFERENCES families (family_id) ON DELETE CASCADE,
  pin_mode TEXT NOT NULL DEFAULT 'off' CHECK (pin_mode IN ('off', 'parent_switch', 'strict')),
  todo_point INT NOT NULL DEFAULT 1 CHECK (todo_point BETWEEN 1 AND 10),
  mission_daily_limit INT NOT NULL DEFAULT 10 CHECK (mission_daily_limit BETWEEN 1 AND 30),
  mission_weekend_limit INT NOT NULL DEFAULT 15 CHECK (mission_weekend_limit BETWEEN 1 AND 30),
  todo_keep_days INT NOT NULL DEFAULT 30 CHECK (todo_keep_days BETWEEN 0 AND 365),
  chat_keep_days INT NOT NULL DEFAULT 7 CHECK (chat_keep_days BETWEEN 1 AND 90),
  overdue_days INT NOT NULL DEFAULT 7 CHECK (overdue_days BETWEEN 1 AND 30),
  default_region TEXT NOT NULL DEFAULT '서울',
  todo_self_create BOOLEAN NOT NULL DEFAULT TRUE,
  todo_approval BOOLEAN NOT NULL DEFAULT TRUE,
  d_day_title TEXT,
  d_day_date DATE,
  theme TEXT DEFAULT 'blue',
  features JSONB DEFAULT '{"outfit":true,"menu":true,"todo":true,"chat":true,"reward":true,"game":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 family_settings 테이블 업그레이드 보장
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS pin_mode TEXT NOT NULL DEFAULT 'off';
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS todo_point INT NOT NULL DEFAULT 1;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS mission_daily_limit INT NOT NULL DEFAULT 10;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS mission_weekend_limit INT NOT NULL DEFAULT 15;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS todo_keep_days INT NOT NULL DEFAULT 30;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS chat_keep_days INT NOT NULL DEFAULT 7;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS overdue_days INT NOT NULL DEFAULT 7;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS default_region TEXT NOT NULL DEFAULT '서울';
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS todo_self_create BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS todo_approval BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS d_day_title TEXT;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS d_day_date DATE;
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'blue';
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"outfit":true,"menu":true,"todo":true,"chat":true,"reward":true,"game":true}'::jsonb;

-- (17) 저녁 메뉴 이미지 매칭 및 하이브리드 캐싱 (menu_items - 50선)
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(30),
  search_keyword VARCHAR(150),
  image_url TEXT,
  source_type VARCHAR(20) DEFAULT 'LOCAL',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. 부모 PIN 인증 및 권한 판정 함수 (RPC)
-- ==============================================================================

-- 유효한 부모 토큰이 가리키는 member_id
CREATE OR REPLACE FUNCTION token_parent_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT s.member_id
  FROM parent_sessions s
  JOIN members m ON m.member_id = s.member_id
  WHERE s.token = current_parent_token()
    AND s.family_id = current_family_id()
    AND s.expires_at > NOW()
    AND m.role = 'parent'
$$;

-- 부모 여부 판정
CREATE OR REPLACE FUNCTION is_parent() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT
    token_parent_id() IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM members m
      WHERE m.member_id = current_member_id()
        AND m.family_id = current_family_id()
        AND m.role = 'parent'
        AND NOT EXISTS (SELECT 1 FROM parent_pins p WHERE p.member_id = m.member_id)
    )
$$;

-- 동작 수행 멤버 식별
CREATE OR REPLACE FUNCTION acting_member_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT coalesce(
    token_parent_id(),
    (SELECT m.member_id FROM members m
      WHERE m.member_id = current_member_id()
        AND m.family_id = current_family_id())
  )
$$;

-- 가족 생성 RPC
CREATE OR REPLACE FUNCTION create_family(p_name TEXT, p_members JSONB)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family_id UUID := gen_random_uuid();
  v_m JSONB;
  v_count INT := 0;
BEGIN
  IF coalesce(trim(p_name), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'name_required');
  END IF;
  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array' OR jsonb_array_length(p_members) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'members_required');
  END IF;

  FOR v_m IN SELECT * FROM jsonb_array_elements(p_members) LOOP
    IF coalesce(trim(v_m ->> 'name'), '') = '' THEN
      RETURN json_build_object('ok', false, 'error', 'member_name_required');
    END IF;
    IF (v_m ->> 'role') NOT IN ('parent', 'child') THEN
      RETURN json_build_object('ok', false, 'error', 'member_role_invalid');
    END IF;
  END LOOP;

  INSERT INTO families (family_id, name) VALUES (v_family_id, trim(p_name));

  FOR v_m IN SELECT * FROM jsonb_array_elements(p_members) LOOP
    INSERT INTO members (family_id, name, role)
      VALUES (v_family_id, trim(v_m ->> 'name'), v_m ->> 'role');
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO family_settings (family_id) VALUES (v_family_id)
  ON CONFLICT (family_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'family_id', v_family_id, 'member_count', v_count);
END $$;

-- 부모 PIN 설정/변경 RPC
CREATE OR REPLACE FUNCTION set_parent_pin(p_member_id UUID, p_new_pin TEXT, p_old_pin TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_existing parent_pins;
  v_max_attempts CONSTANT INT := 5;
  v_lock_duration CONSTANT INTERVAL := INTERVAL '15 minutes';
BEGIN
  IF v_family IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'family_required');
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('ok', false, 'error', 'pin_must_be_4_digits');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members m
    WHERE m.member_id = p_member_id AND m.family_id = v_family AND m.role = 'parent'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'not_a_parent');
  END IF;

  SELECT * INTO v_existing FROM parent_pins WHERE member_id = p_member_id;

  IF v_existing.member_id IS NOT NULL THEN
    IF v_existing.locked_until IS NOT NULL AND v_existing.locked_until > NOW() THEN
      RETURN json_build_object('ok', false, 'error', 'locked', 'locked_until', v_existing.locked_until);
    END IF;

    IF p_old_pin IS NULL OR v_existing.pin_hash <> crypt(p_old_pin, v_existing.pin_hash) THEN
      UPDATE parent_pins
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE
              WHEN failed_attempts + 1 >= v_max_attempts THEN NOW() + v_lock_duration
              ELSE NULL
            END
        WHERE member_id = p_member_id;
      RETURN json_build_object('ok', false, 'error', 'old_pin_mismatch',
        'attempts_left', greatest(0, v_max_attempts - (v_existing.failed_attempts + 1)));
    END IF;

    UPDATE parent_pins
      SET pin_hash = crypt(p_new_pin, gen_salt('bf', 8)),
          failed_attempts = 0, locked_until = NULL, updated_at = NOW()
      WHERE member_id = p_member_id;
    DELETE FROM parent_sessions WHERE member_id = p_member_id;
    RETURN json_build_object('ok', true, 'created', false);
  END IF;

  IF EXISTS (SELECT 1 FROM parent_pins p WHERE p.family_id = v_family)
     AND token_parent_id() IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'parent_auth_required');
  END IF;

  INSERT INTO parent_pins (member_id, family_id, pin_hash)
    VALUES (p_member_id, v_family, crypt(p_new_pin, gen_salt('bf', 8)));
  RETURN json_build_object('ok', true, 'created', true);
END $$;

-- 부모 로그인 RPC
CREATE OR REPLACE FUNCTION parent_login(p_member_id UUID, p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_rec parent_pins;
  v_token UUID;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  IF v_family IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'family_required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members m
    WHERE m.member_id = p_member_id AND m.family_id = v_family AND m.role = 'parent'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'not_a_parent');
  END IF;

  SELECT * INTO v_rec FROM parent_pins WHERE member_id = p_member_id;
  IF v_rec.member_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'pin_not_set');
  END IF;
  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > NOW() THEN
    RETURN json_build_object('ok', false, 'error', 'locked', 'locked_until', v_rec.locked_until);
  END IF;

  IF v_rec.pin_hash <> crypt(p_pin, v_rec.pin_hash) THEN
    UPDATE parent_pins
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
      WHERE member_id = p_member_id;
    RETURN json_build_object('ok', false, 'error', 'invalid_pin',
      'attempts_left', greatest(0, 5 - (v_rec.failed_attempts + 1)));
  END IF;

  UPDATE parent_pins SET failed_attempts = 0, locked_until = NULL WHERE member_id = p_member_id;

  DELETE FROM parent_sessions WHERE expires_at < NOW();
  INSERT INTO parent_sessions (member_id, family_id, expires_at)
    VALUES (p_member_id, v_family, v_expires)
    RETURNING token INTO v_token;

  RETURN json_build_object('ok', true, 'token', v_token, 'member_id', p_member_id, 'expires_at', v_expires);
END $$;

-- 부모 로그아웃 RPC
CREATE OR REPLACE FUNCTION parent_logout() RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  DELETE FROM parent_sessions
    WHERE token = current_parent_token() AND family_id = current_family_id();
  RETURN json_build_object('ok', true);
END $$;

-- 자녀 완료 토글 RPC
CREATE OR REPLACE FUNCTION toggle_my_todo(p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_actor UUID := acting_member_id();
  v_todo todos;
BEGIN
  IF v_family IS NULL OR v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'identity_required');
  END IF;

  SELECT * INTO v_todo FROM todos
    WHERE todo_id = p_todo_id AND family_id = v_family;
  IF v_todo.todo_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT is_parent() AND v_todo.assignee_member_id IS DISTINCT FROM v_actor THEN
    RETURN json_build_object('ok', false, 'error', 'not_your_todo');
  END IF;

  UPDATE todos SET
    is_done      = NOT v_todo.is_done,
    completed_by = CASE WHEN NOT v_todo.is_done THEN v_actor ELSE NULL END,
    completed_at = CASE WHEN NOT v_todo.is_done THEN NOW() ELSE NULL END,
    approved_by  = CASE WHEN NOT v_todo.is_done THEN v_todo.approved_by ELSE NULL END,
    approved_at  = CASE WHEN NOT v_todo.is_done THEN v_todo.approved_at ELSE NULL END
    WHERE todo_id = p_todo_id
    RETURNING * INTO v_todo;

  RETURN json_build_object('ok', true, 'todo', row_to_json(v_todo));
END $$;

-- 부모 할 일 승인/도장 RPC
CREATE OR REPLACE FUNCTION approve_todo(p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_actor  UUID := acting_member_id();
  v_todo   todos;
BEGIN
  IF v_family IS NULL OR v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'identity_required');
  END IF;
  IF NOT is_parent() THEN
    RETURN json_build_object('ok', false, 'error', 'parent_only');
  END IF;

  SELECT * INTO v_todo FROM todos
    WHERE todo_id = p_todo_id AND family_id = v_family;
  IF v_todo.todo_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF NOT v_todo.is_done THEN
    RETURN json_build_object('ok', false, 'error', 'not_done');
  END IF;

  UPDATE todos SET
    approved_by = CASE WHEN v_todo.approved_by IS NULL THEN v_actor ELSE NULL END,
    approved_at = CASE WHEN v_todo.approved_by IS NULL THEN NOW() ELSE NULL END
    WHERE todo_id = p_todo_id
    RETURNING * INTO v_todo;

  RETURN json_build_object('ok', true, 'todo', row_to_json(v_todo));
END $$;

-- 자녀 스스로 할 일 추가 RPC
CREATE OR REPLACE FUNCTION add_my_todo(p_title TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_actor  UUID := acting_member_id();
  v_title  TEXT := btrim(coalesce(p_title, ''));
  v_count  INT;
  v_todo   todos;
BEGIN
  IF v_family IS NULL OR v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'identity_required');
  END IF;
  IF v_title = '' THEN
    RETURN json_build_object('ok', false, 'error', 'empty_title');
  END IF;
  IF char_length(v_title) > 40 THEN
    RETURN json_build_object('ok', false, 'error', 'too_long');
  END IF;

  SELECT count(*) INTO v_count FROM todos
    WHERE family_id = v_family
      AND assignee_member_id = v_actor
      AND self_made
      AND due_date = current_date;
  IF v_count >= 10 THEN
    RETURN json_build_object('ok', false, 'error', 'daily_limit');
  END IF;

  IF EXISTS (
    SELECT 1 FROM todos
      WHERE family_id = v_family
        AND assignee_member_id = v_actor
        AND due_date = current_date
        AND lower(btrim(title)) = lower(v_title)
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'duplicate');
  END IF;

  INSERT INTO todos (family_id, title, assignee_member_id, due_date, self_made)
    VALUES (v_family, v_title, v_actor, current_date, true)
    RETURNING * INTO v_todo;

  RETURN json_build_object('ok', true, 'todo', row_to_json(v_todo));
END $$;

-- 자녀 본인 생성 할 일 삭제 RPC
CREATE OR REPLACE FUNCTION delete_my_todo(p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_actor  UUID := acting_member_id();
  v_todo   todos;
BEGIN
  IF v_family IS NULL OR v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'identity_required');
  END IF;

  SELECT * INTO v_todo FROM todos
    WHERE todo_id = p_todo_id AND family_id = v_family;
  IF v_todo.todo_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT is_parent() AND (NOT v_todo.self_made OR v_todo.assignee_member_id IS DISTINCT FROM v_actor) THEN
    RETURN json_build_object('ok', false, 'error', 'cannot_delete');
  END IF;

  DELETE FROM todos WHERE todo_id = p_todo_id;
  RETURN json_build_object('ok', true);
END $$;

-- 설정값 조회 헬퍼
CREATE OR REPLACE FUNCTION family_setting_int(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT CASE p_key
       WHEN 'todo_point' THEN todo_point
       WHEN 'mission_daily_limit' THEN mission_daily_limit
       WHEN 'mission_weekend_limit' THEN mission_weekend_limit
       WHEN 'todo_keep_days' THEN todo_keep_days
       WHEN 'chat_keep_days' THEN chat_keep_days
       WHEN 'overdue_days' THEN overdue_days
     END
     FROM family_settings WHERE family_id = current_family_id()),
    p_default)
$$;

-- 오래된 할 일 정리 RPC
CREATE OR REPLACE FUNCTION purge_old_todos()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_days   INT  := family_setting_int('todo_keep_days', 30);
  v_deleted INTEGER;
BEGIN
  IF v_family IS NULL OR v_days <= 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM todos
   WHERE family_id = v_family
     AND NOT is_done
     AND due_date < app_today() - v_days;

  GET DIAGNOSTICS v_deleted = row_count;
  RETURN v_deleted;
END $$;

-- 오래된 채팅 자동 정리 RPC
CREATE OR REPLACE FUNCTION delete_old_chat_messages()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM chat_messages c
  WHERE c.created_at < NOW() - (
    coalesce((SELECT s.chat_keep_days FROM family_settings s WHERE s.family_id = c.family_id), 7)
    || ' days')::interval;
  GET DIAGNOSTICS v_deleted = row_count;
  RETURN v_deleted;
END $$;

-- ==============================================================================
-- 5. 권한 부여 (GRANT EXECUTE)
-- ==============================================================================

GRANT EXECUTE ON FUNCTION safe_uuid(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION request_header(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_family_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_member_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_parent_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seoul_today() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_today() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION token_parent_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_parent() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION acting_member_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_family(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_parent_pin(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION parent_login(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION parent_logout() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_my_todo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_todo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_my_todo(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_my_todo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_old_todos() TO anon, authenticated;

-- ==============================================================================
-- 6. RLS 보안 활성화 및 정책(Policies)
-- ==============================================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_outfit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- (1) families
DROP POLICY IF EXISTS "families_select" ON families;
CREATE POLICY "families_select" ON families FOR SELECT TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "families_insert" ON families;
CREATE POLICY "families_insert" ON families FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "families_update" ON families;
CREATE POLICY "families_update" ON families FOR UPDATE TO anon, authenticated
USING (family_id = current_family_id() AND is_parent())
WITH CHECK (family_id = current_family_id() AND is_parent());

-- (2) members
DROP POLICY IF EXISTS "members_select" ON members;
CREATE POLICY "members_select" ON members FOR SELECT TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "members_write" ON members;
CREATE POLICY "members_write" ON members FOR ALL TO anon, authenticated
USING (family_id = current_family_id() AND is_parent())
WITH CHECK (family_id = current_family_id() AND is_parent());

-- (3) weekly_outfit_rules & wardrobe_items
DROP POLICY IF EXISTS "weekly_outfit_rules_select" ON weekly_outfit_rules;
CREATE POLICY "weekly_outfit_rules_select" ON weekly_outfit_rules FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "weekly_outfit_rules_write" ON weekly_outfit_rules;
CREATE POLICY "weekly_outfit_rules_write" ON weekly_outfit_rules FOR ALL TO anon, authenticated
USING (is_parent()) WITH CHECK (is_parent());

DROP POLICY IF EXISTS "wardrobe_items_all" ON wardrobe_items;
CREATE POLICY "wardrobe_items_all" ON wardrobe_items FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

-- (4) todos
DROP POLICY IF EXISTS "todos_select" ON todos;
CREATE POLICY "todos_select" ON todos FOR SELECT TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "todos_write" ON todos;
CREATE POLICY "todos_write" ON todos FOR ALL TO anon, authenticated
USING (family_id = current_family_id() AND is_parent())
WITH CHECK (family_id = current_family_id() AND is_parent());

-- (5) quick_tasks & rewards & schedules
DROP POLICY IF EXISTS "quick_tasks_all" ON quick_tasks;
CREATE POLICY "quick_tasks_all" ON quick_tasks FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "rewards_all" ON rewards;
CREATE POLICY "rewards_all" ON rewards FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "schedules_all" ON schedules;
CREATE POLICY "schedules_all" ON schedules FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

-- (6) recipes & favorite_links
DROP POLICY IF EXISTS "recipes_all" ON recipes;
CREATE POLICY "recipes_all" ON recipes FOR ALL TO anon, authenticated
USING (family_id IS NULL OR family_id = current_family_id())
WITH CHECK (family_id IS NULL OR family_id = current_family_id());

DROP POLICY IF EXISTS "favorite_links_all" ON favorite_links;
CREATE POLICY "favorite_links_all" ON favorite_links FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

-- (7) chat_messages & game_results
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO anon, authenticated
WITH CHECK (family_id = current_family_id());

DROP POLICY IF EXISTS "chat_messages_delete" ON chat_messages;
CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE TO anon, authenticated
USING (family_id = current_family_id() AND is_parent());

DROP POLICY IF EXISTS "game_results_all" ON game_results;
CREATE POLICY "game_results_all" ON game_results FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "game_sessions_all" ON game_sessions;
CREATE POLICY "game_sessions_all" ON game_sessions FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

-- (8) push_subscriptions & family_settings & menu_items
DROP POLICY IF EXISTS "push_subscriptions_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "family_settings_all" ON family_settings;
CREATE POLICY "family_settings_all" ON family_settings FOR ALL TO anon, authenticated
USING (family_id = current_family_id() OR current_family_id() IS NULL)
WITH CHECK (family_id = current_family_id() OR current_family_id() IS NULL);

DROP POLICY IF EXISTS "menu_items_all" ON menu_items;
CREATE POLICY "menu_items_all" ON menu_items FOR ALL TO anon, authenticated
USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. 성능 최적화 인덱스 (실제 컬럼명 일치 보장)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_todos_family_due ON todos(family_id, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_assignee ON todos(assignee_member_id);
CREATE INDEX IF NOT EXISTS idx_schedules_family_member ON schedules(family_id, member_id);
CREATE INDEX IF NOT EXISTS idx_schedules_family_date ON schedules(family_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_recipes_family ON recipes(family_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_chat_messages_family ON chat_messages(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_parent_sessions_lookup ON parent_sessions(token, family_id);

-- ==============================================================================
-- 8. 대표 저녁 메뉴 50선 시드 데이터 (검증된 고화질 홈메이드 이미지 반영)
-- ==============================================================================

INSERT INTO menu_items (name, category, search_keyword, image_url, source_type) VALUES
-- [찌개/국물류 (12종)]
('김치찌개', '찌개/국물류', 'Kimchi jjigae stew', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg', 'LOCAL'),
('된장찌개', '찌개/국물류', 'Doenjang jjigae korean stew', '/images/doenjang_jjigae.jpg', 'LOCAL'),
('순두부찌개', '찌개/국물류', 'Sundubu jjigae soft tofu stew', '/images/sundubu_jjigae.jpg', 'LOCAL'),
('부대찌개', '찌개/국물류', 'Budae jjigae army stew', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg', 'LOCAL'),
('청국장', '찌개/국물류', 'Cheonggukjang fermented soybean stew', '/images/doenjang_jjigae.jpg', 'LOCAL'),
('삼계탕', '찌개/국물류', 'Samgyetang korean ginseng chicken', 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('갈비탕', '찌개/국물류', 'Galbitang short rib soup', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('감자탕', '찌개/국물류', 'Gamjatang pork bone soup', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg', 'LOCAL'),
('소고기미역국', '찌개/국물류', 'Korean seaweed soup beef', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MDRfNzgg%2FMDAxNzgwNTY4NjgzMjM1.TDbC-2o_OEGheJH9u-Ab48Bo3Obnfq64Rkj0EiG-e3gg.1qydX-5pPhz9FSEqs0Fye6AJxCscJz_HkCVS6BV8LUgg.JPEG%2F802260999.962271.jpg', 'LOCAL'),
('소고기무국', '찌개/국물류', 'Korean beef radish soup', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MDRfNzgg%2FMDAxNzgwNTY4NjgzMjM1.TDbC-2o_OEGheJH9u-Ab48Bo3Obnfq64Rkj0EiG-e3gg.1qydX-5pPhz9FSEqs0Fye6AJxCscJz_HkCVS6BV8LUgg.JPEG%2F802260999.962271.jpg', 'LOCAL'),
('육개장', '찌개/국물류', 'Yukgaejang spicy beef soup', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg', 'LOCAL'),
('콩나물국', '찌개/국물류', 'Kongnamul guk soybean sprout soup', 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

-- [고기/구이/볶음류 (14종)]
('제육볶음', '고기/구이/볶음류', 'Jeyuk bokkeum spicy pork', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDhfODEg%2FMDAxNjE3ODY5NTAxNTg5.0WXJn8pFWiPGHtDN9hzyL6_oca8iDncAMUPGqtHF9gYg.vA8aOyxNqYCclFtcioaSjLXCRkazfH_rGY4Nvb4Tv5sg.JPEG.peace8012%2FIMG_4081.JPG', 'LOCAL'),
('소불고기', '고기/구이/볶음류', 'Korean beef bulgogi', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEyMjNfMjU5%2FMDAxNzY2NDg0OTU2Nzc2.vxeG0V8wnuWrDtro80k5QI4tdh_JGK9x4fd4bGfTX0gg.UFtuEg4alI6HDqVyRqEfrw8r_YfuAq-XHQTyfuCM7xcg.JPEG%2Foutput%25A3%25DF264553869.jpg', 'LOCAL'),
('돼지갈비찜', '고기/구이/볶음류', 'Korean braised pork ribs', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjZfMjk4%2FMDAxNjk1NzAzMjAwMjUx.17KJXVWmwt0zyi2wRjtv5TxV3CCM8_wRq17Bn-Z4M24g.Sny4Yg89_8CdH9l2Smcdp8RysERLoSmArR6R66DWBIMg.JPEG.wjdwldbs9999%2FIMG_3052.jpg', 'LOCAL'),
('소갈비찜', '고기/구이/볶음류', 'Galbijjim braised beef short ribs', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjZfMjk4%2FMDAxNjk1NzAzMjAwMjUx.17KJXVWmwt0zyi2wRjtv5TxV3CCM8_wRq17Bn-Z4M24g.Sny4Yg89_8CdH9l2Smcdp8RysERLoSmArR6R66DWBIMg.JPEG.wjdwldbs9999%2FIMG_3052.jpg', 'LOCAL'),
('삼겹살구이', '고기/구이/볶음류', 'Samgyeopsal grilled pork belly', '/images/samgyeopsal.jpg', 'LOCAL'),
('닭볶음탕', '고기/구이/볶음류', 'Dakbokkeumtang spicy chicken stew', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA1MjRfMzMg%2FMDAxNjg0OTMxMDc3NDc1.3fvQPZWDYGkKyt5gg30AHfkC1gwTfQjIpsH1OhaOVf4g.IL_TBEJ_5KCbj0Ib9F098kqwX7mXQ6inYeanUt6n-rEg.JPEG.onlyuu_%2FKakaoTalk_20230524_211540210_10.jpg', 'LOCAL'),
('찜닭', '고기/구이/볶음류', 'Andong jjimdak braised chicken', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('훈제오리구이', '고기/구이/볶음류', 'Smoked duck vegetable stir fry', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('수육/보쌈', '고기/구이/볶음류', 'Bossam boiled pork belly korean', '/images/bossam_suyuk.jpg', 'LOCAL'),
('족발', '고기/구이/볶음류', 'Jokbal korean braised pigs trotters', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('떡갈비', '고기/구이/볶음류', 'Tteokgalbi grilled short rib patties', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('오삼불고기', '고기/구이/볶음류', 'Osam bulgogi squid pork stir fry', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('춘천닭갈비', '고기/구이/볶음류', 'Dakgalbi spicy stir fried chicken', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('두부조림', '고기/구이/볶음류', 'Dubu jorim braised tofu', '/images/tofu_jorim.jpg', 'LOCAL'),

-- [해산물류 (6종)]
('고등어구이', '해산물류', 'Grilled mackerel fish korean', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg', 'LOCAL'),
('갈치조림', '해산물류', 'Galchi jorim braised hairtail', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg', 'LOCAL'),
('고등어무조림', '해산물류', 'Braised mackerel with radish', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg', 'LOCAL'),
('오징어볶음', '해산물류', 'Ojingeo bokkeum spicy squid', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('낙지볶음', '해산물류', 'Nakji bokkeum spicy octopus', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('해물파전', '해산물류', 'Haemul pajeon seafood pancake', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg', 'LOCAL'),

-- [한그릇/면류 (11종)]
('비빔밥', '한그릇/면류', 'Bibimbap korean mixed rice', '/images/bibimbap.jpg', 'LOCAL'),
('돌솥비빔밥', '한그릇/면류', 'Dolsot bibimbap hot stone', '/images/bibimbap.jpg', 'LOCAL'),
('잡채', '한그릇/면류', 'Japchae korean glass noodles', '/images/japchae.jpg', 'LOCAL'),
('궁중잡채', '한그릇/면류', 'Royal court japchae beef', '/images/japchae.jpg', 'LOCAL'),
('김치볶음밥', '한그릇/면류', 'Kimchi fried rice egg', '/images/kimchi_fried_rice.jpg', 'LOCAL'),
('참치마요 덮밥', '한그릇/면류', 'Tuna mayo rice bowl', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA0MTFfMTgy%2FMDAxNzQ0Mzc4NjA4MjU5.us5Id840wyDQ6iWsjw4Ml7t9NkWwxHr7ZYPZlZAGh24g.dwPPOiUiB-TR6IcydbWHHDDkeltXEIeY8NKcbIX2c0Ag.JPEG%2FIMG_5121.JPG', 'LOCAL'),
('카레라이스', '한그릇/면류', 'Curry rice bowl', 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('오므라이스', '한그릇/면류', 'Omurice egg rice', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG', 'LOCAL'),
('잔치국수', '한그릇/면류', 'Janchi guksu warm noodle soup', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('비빔국수', '한그릇/면류', 'Bibim guksu spicy noodles', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('떡볶이', '한그릇/면류', 'Tteokbokki spicy rice cakes', '/images/tteokbokki.jpg', 'LOCAL'),

-- [양식/퓨전 (7종)]
('돈가스', '양식/퓨전', 'Tonkatsu pork cutlet', 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('돈까스', '양식/퓨전', 'Tonkatsu pork cutlet crisp', 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('함박스테이크', '양식/퓨전', 'Hamburger steak patty gravy', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('토마토파스타', '양식/퓨전', 'Tomato pasta spaghetti', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('크림파스타', '양식/퓨전', 'Cream pasta fettuccine', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('알리오올리오', '양식/퓨전', 'Aglio e olio garlic pasta', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('찹스테이크', '양식/퓨전', 'Chop steak beef vegetables', 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', 'LOCAL')
ON CONFLICT (name) DO UPDATE
SET category = EXCLUDED.category,
    search_keyword = EXCLUDED.search_keyword,
    image_url = EXCLUDED.image_url,
    source_type = EXCLUDED.source_type;

-- ==============================================================================
-- 9. 기본 공용 레시피 (14종) 시드 데이터 (조리순서 및 최신 이미지 매핑)
-- ==============================================================================

INSERT INTO recipes (family_id, title, description, steps, cook_minutes, image_url) VALUES
(NULL, '된장찌개 정식', '된장 1큰술, 두부 반 모, 애호박 1/4개, 감자 1개, 대파 조금 / 뚝배기에 끓여 밥과 함께 내요', 
'재료를 먹기 좋은 크기로 썰어요.
냄비에 물 2컵을 붓고 된장 1큰술을 풀어요.
감자와 애호박을 넣고 5분 끓여요.
두부와 대파를 넣고 2분 더 끓이면 완성이에요.', 20, '/images/doenjang_jjigae.jpg'),

(NULL, '소불고기 덮밥', '불고기용 소고기 150g, 양파 반 개, 당근 조금, 불고기양념 2큰술, 밥 1공기 / 달콤짭조름하게 볶아 밥 위에 올려요',
'양파와 당근을 얇게 채 썰어요.
팬에 기름을 두르고 소불고기를 볶아요.
고기 색이 변하면 채소를 넣고 함께 볶아요.
간장 1큰술로 간을 맞추고 밥 위에 올려요.', 15, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEyMjNfMjU5%2FMDAxNzY2NDg0OTU2Nzc2.vxeG0V8wnuWrDtro80k5QI4tdh_JGK9x4fd4bGfTX0gg.UFtuEg4alI6HDqVyRqEfrw8r_YfuAq-XHQTyfuCM7xcg.JPEG%2Foutput%25A3%25DF264553869.jpg'),

(NULL, '김치볶음밥', '신김치 1컵, 밥 1공기, 참기름 1작은술, 달걀 1개, 김가루 조금 / 김치를 달달 볶아 고소하게 완성해요',
'묵은지를 잘게 썰어 기름에 먼저 볶아요.
신맛이 날아가면 찬밥을 넣고 눌러가며 볶아요.
참기름을 두르고 불을 꺼요.
달걀프라이를 올려 완성해요.', 15, '/images/kimchi_fried_rice.jpg'),

(NULL, '계란말이와 밥', '달걀 3개, 당근 조금, 쪽파 조금, 소금 한 꼬집 / 도톰하게 말아 한입 크기로 썰어요',
'달걀 3개를 풀고 소금을 조금 넣어요.
당근과 쪽파를 잘게 다져 섞어요.
약한 불에서 얇게 부어 조금씩 말아요.
한 김 식힌 뒤 썰어야 모양이 유지돼요.', 15, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg'),

(NULL, '참치마요 덮밥', '밥 1공기, 참치캔 반 캔, 마요네즈 1.5큰술, 김가루, 양파 조금 / 쓱쓱 비벼 먹는 초간단 한 그릇',
'참치캔의 기름을 꼭 짜서 빼요.
마요네즈와 다진 양파를 넣고 버무려요.
밥 위에 올리고 김가루를 뿌려요.', 10, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA0MTFfMTgy%2FMDAxNzQ0Mzc4NjA4MjU5.us5Id840wyDQ6iWsjw4Ml7t9NkWwxHr7ZYPZlZAGh24g.dwPPOiUiB-TR6IcydbWHHDDkeltXEIeY8NKcbIX2c0Ag.JPEG%2FIMG_5121.JPG'),

(NULL, '제육볶음', '돼지 앞다리살 200g, 양파 반 개, 대파 반 대, 고추장양념 2큰술 / 매콤하게 볶아 쌈 채소와 곁들여요',
'고추장 2큰술, 간장 1큰술, 설탕 1큰술을 섞어 양념을 만들어요.
앞다리살에 양념을 발라 20분 재워요.
센 불에 고기를 먼저 볶아요.
양파와 대파를 넣고 숨이 죽을 때까지 볶아요.', 20, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDhfODEg%2FMDAxNjE3ODY5NTAxNTg5.0WXJn8pFWiPGHtDN9hzyL6_oca8iDncAMUPGqtHF9gYg.vA8aOyxNqYCclFtcioaSjLXCRkazfH_rGY4Nvb4Tv5sg.JPEG.peace8012%2FIMG_4081.JPG'),

(NULL, '카레라이스', '카레가루 3큰술, 감자 1개, 당근 반 개, 양파 반 개, 밥 1공기 / 채소가 푹 익을 때까지 끓여요',
'감자, 당근, 양파를 깍둑썰기 해요.
냄비에 기름을 두르고 채소를 볶아요.
물 3컵을 붓고 감자가 익을 때까지 끓여요.
불을 줄이고 카레가루를 풀어 3분 더 끓여요.', 25, 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80'),

(NULL, '잔치국수', '소면 1줌, 멸치육수 3컵, 애호박 조금, 당근 조금, 김가루 / 따뜻한 국물에 소면을 말아요',
'멸치육수를 끓여 국간장으로 간해요.
소면을 3분 삶아 찬물에 헹궈요.
애호박은 채 썰어 살짝 볶아요.
그릇에 면을 담고 육수를 부은 뒤 고명을 올려요.', 15, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80'),

(NULL, '두부조림', '두부 1모, 간장 2큰술, 고춧가루 1큰술, 다진 마늘 반 작은술, 대파 / 노릇하게 부친 두부에 양념장을 졸여요',
'두부를 도톰하게 썰어 물기를 닦아요.
팬에 노릇하게 앞뒤로 구워요.
간장 2큰술, 고춧가루 1큰술, 물 3큰술을 섞어 부어요.
약한 불에서 조리다 대파를 올려요.', 20, '/images/tofu_jorim.jpg'),

(NULL, '오므라이스', '밥 1공기, 달걀 2개, 당근·양파 다진 것, 케첩 2큰술 / 볶음밥 위에 부드러운 달걀옷을 입혀요',
'양파를 다져 밥과 함께 볶고 케첩으로 간해요.
볶은 밥을 접시에 담아 모양을 잡아요.
달걀 2개를 풀어 얇은 지단을 부쳐요.
지단으로 밥을 덮고 케첩을 뿌려요.', 20, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG'),

(NULL, '된장국과 생선구이', '고등어 반 토막, 아욱 조금, 된장 1큰술, 두부 1/4모 / 겉은 바삭 속은 촉촉하게 구워요',
'고등어의 물기를 키친타월로 닦아요.
달군 팬에 껍질 쪽부터 구워요.
된장국은 아욱과 두부를 넣고 끓여요.
생선이 노릇해지면 뒤집어 3분 더 구워요.', 25, 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg'),

(NULL, '비빔밥', '밥 1공기, 콩나물, 시금치, 당근나물, 달걀프라이 1개, 고추장 1큰술 / 오색 나물과 고추장, 참기름으로 슥슥',
'남은 나물을 종류별로 그릇에 담아요.
가운데에 달걀프라이를 올려요.
고추장 1큰술과 참기름을 넣어요.
먹기 직전에 골고루 비벼요.', 15, '/images/bibimbap.jpg'),

(NULL, '잡채', '당면 100g, 소고기 50g, 시금치, 당근, 양파, 목이버섯, 간장 2큰술, 참기름 / 탱글탱글 윤기 도는 잔치 잡채',
'당면을 끓는 물에 6분 삶아 찬물에 헹군 뒤 참기름에 버무려요.
소고기와 채소들을 각각 간장 양념에 볶아 식혀요.
모든 재료를 볼에 담고 간장, 설탕, 참기름을 넣어 골고루 무쳐요.
통깨를 뿌려 완성해요.', 30, '/images/japchae.jpg'),

(NULL, '떡볶이', '떡볶이 떡 200g, 사각어묵 2장, 대파 반 대, 고추장 2큰술, 고춧가루 1큰술, 설탕 1큰술 / 매콤달콤 쫀득한 국민 간식',
'떡을 찬물에 10분 불려두고 어묵과 대파를 먹기 좋게 썰어요.
냄비에 물 2컵, 고추장, 고춧가루, 설탕, 진간장을 넣고 끓여요.
국물이 끓어오르면 떡과 어묵을 넣고 중불에서 5분간 졸여요.
대파를 넣고 국물이 자작해질 때까지 2분 더 끓인 뒤 통깨를 뿌려요.', 15, '/images/tteokbokki.jpg')
ON CONFLICT (recipe_id) DO NOTHING;

-- (15) 개인별 맞춤 정보 피드 카테고리 (member_feed_preferences)
CREATE TABLE IF NOT EXISTS member_feed_preferences (
  member_id UUID PRIMARY KEY REFERENCES members (member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE member_feed_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "member_feed_preferences_all" ON member_feed_preferences;
CREATE POLICY "member_feed_preferences_all" ON member_feed_preferences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 10. 최종 확인
-- ==============================================================================
SELECT 'Kinship Master Schema Successfully Installed!' AS status;
