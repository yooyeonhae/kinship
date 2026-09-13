-- ==============================================================================
-- Kinship Module 1: Core & Authentication (가족, 구성원, PIN 보안, 가족 설정)
-- File: app/supabase/modules/01_core_auth.sql
-- ==============================================================================

-- 0. 필수 확장 모듈
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 헤더 파싱 및 세션 헬퍼 함수
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

-- 2. 테이블 정의

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
  avatar TEXT,
  avatar_url TEXT,
  color TEXT DEFAULT '#3b82f6',
  stars INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- (5) 가족 맞춤 설정 테이블 (family_settings)
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

-- 3. 부모 권한 검증 헬퍼
CREATE OR REPLACE FUNCTION token_parent_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT member_id
  FROM parent_sessions
  WHERE token = current_parent_token()
    AND family_id = current_family_id()
    AND expires_at > NOW()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_parent() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN token_parent_id() IS NOT NULL THEN TRUE
    ELSE EXISTS (
      SELECT 1 FROM members m
      LEFT JOIN parent_pins p ON p.member_id = m.member_id
      WHERE m.member_id = current_member_id()
        AND m.family_id = current_family_id()
        AND m.role = 'parent'
        AND p.member_id IS NULL
    )
  END
$$;

CREATE OR REPLACE FUNCTION acting_member_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(token_parent_id(), current_member_id())
$$;

-- 4. RLS 정책 설정
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_settings ENABLE ROW LEVEL SECURITY;

-- families 정책
DROP POLICY IF EXISTS "families_select_own" ON families;
CREATE POLICY "families_select_own" ON families FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "families_insert" ON families;
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (family_id = current_family_id());

DROP POLICY IF EXISTS "families_update_own" ON families;
CREATE POLICY "families_update_own" ON families FOR UPDATE USING (family_id = current_family_id() AND is_parent());

-- members 정책
DROP POLICY IF EXISTS "members_select_own" ON members;
CREATE POLICY "members_select_own" ON members FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "members_write_parent" ON members;
CREATE POLICY "members_write_parent" ON members FOR ALL USING (family_id = current_family_id() AND is_parent());

-- parent_pins, parent_sessions (클라이언트 직접 접근 차단, RPC 전용)
REVOKE ALL ON parent_pins FROM anon, authenticated;
REVOKE ALL ON parent_sessions FROM anon, authenticated;

-- family_settings 정책
DROP POLICY IF EXISTS "family_settings_select_family" ON family_settings;
CREATE POLICY "family_settings_select_family" ON family_settings FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "family_settings_write_parent" ON family_settings;
CREATE POLICY "family_settings_write_parent" ON family_settings FOR ALL USING (family_id = current_family_id() AND is_parent()) WITH CHECK (family_id = current_family_id() AND is_parent());

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_parent_sessions_lookup ON parent_sessions(token, family_id);

-- 6. 코어 RPC 함수 정의 (타입 충돌 방지용 DROP FUNCTION CASCADE)
DROP FUNCTION IF EXISTS create_family(TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS set_parent_pin(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_parent_pin(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS parent_login(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS parent_logout() CASCADE;
DROP FUNCTION IF EXISTS family_setting_int(TEXT, INTEGER) CASCADE;

-- (1) 가족 생성 RPC
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

-- (2) 부모 PIN 설정/변경 RPC
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

-- (3) 부모 로그인 RPC
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

-- (4) 부모 로그아웃 RPC
CREATE OR REPLACE FUNCTION parent_logout() RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  DELETE FROM parent_sessions
    WHERE token = current_parent_token() AND family_id = current_family_id();
  RETURN json_build_object('ok', true);
END $$;

-- (5) 설정값 조회 헬퍼
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

-- (6) 가족 식구 추가 RPC
DROP FUNCTION IF EXISTS add_family_member(TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION add_family_member(p_name TEXT, p_role TEXT, p_avatar TEXT DEFAULT NULL, p_color TEXT DEFAULT '#3b82f6')
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_member members;
BEGIN
  IF v_family IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'family_required');
  END IF;
  IF NOT is_parent() THEN
    RETURN json_build_object('ok', false, 'error', 'parent_only');
  END IF;
  IF v_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'name_required');
  END IF;
  IF char_length(v_name) > 20 THEN
    RETURN json_build_object('ok', false, 'error', 'name_too_long');
  END IF;
  IF p_role NOT IN ('parent', 'child') THEN
    RETURN json_build_object('ok', false, 'error', 'role_invalid');
  END IF;

  INSERT INTO members (family_id, name, role, avatar, color, stars)
  VALUES (v_family, v_name, p_role, p_avatar, coalesce(p_color, '#3b82f6'), 0)
  RETURNING * INTO v_member;

  RETURN json_build_object('ok', true, 'member', row_to_json(v_member));
END $$;

-- (7) 가족 식구 정보 수정 RPC
DROP FUNCTION IF EXISTS update_family_member(UUID, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION update_family_member(p_member_id UUID, p_name TEXT, p_role TEXT, p_avatar TEXT DEFAULT NULL, p_color TEXT DEFAULT '#3b82f6')
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_existing members;
  v_parent_count INT;
  v_updated members;
BEGIN
  IF v_family IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'family_required');
  END IF;
  IF NOT is_parent() THEN
    RETURN json_build_object('ok', false, 'error', 'parent_only');
  END IF;
  IF v_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'name_required');
  END IF;
  IF char_length(v_name) > 20 THEN
    RETURN json_build_object('ok', false, 'error', 'name_too_long');
  END IF;
  IF p_role NOT IN ('parent', 'child') THEN
    RETURN json_build_object('ok', false, 'error', 'role_invalid');
  END IF;

  SELECT * INTO v_existing FROM members WHERE member_id = p_member_id AND family_id = v_family;
  IF v_existing.member_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- 마지막 부모를 자녀로 강등하려는 경우 차단
  IF v_existing.role = 'parent' AND p_role = 'child' THEN
    SELECT count(*) INTO v_parent_count FROM members WHERE family_id = v_family AND role = 'parent';
    IF v_parent_count <= 1 THEN
      RETURN json_build_object('ok', false, 'error', 'last_parent_cannot_be_child');
    END IF;
  END IF;

  UPDATE members SET
    name = v_name,
    role = p_role,
    avatar = p_avatar,
    color = coalesce(p_color, '#3b82f6')
  WHERE member_id = p_member_id AND family_id = v_family
  RETURNING * INTO v_updated;

  RETURN json_build_object('ok', true, 'member', row_to_json(v_updated));
END $$;

-- (8) 가족 식구 삭제 RPC
DROP FUNCTION IF EXISTS delete_family_member(UUID) CASCADE;
CREATE OR REPLACE FUNCTION delete_family_member(p_member_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_existing members;
  v_parent_count INT;
BEGIN
  IF v_family IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'family_required');
  END IF;
  IF NOT is_parent() THEN
    RETURN json_build_object('ok', false, 'error', 'parent_only');
  END IF;

  SELECT * INTO v_existing FROM members WHERE member_id = p_member_id AND family_id = v_family;
  IF v_existing.member_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- 마지막 부모 삭제 차단
  IF v_existing.role = 'parent' THEN
    SELECT count(*) INTO v_parent_count FROM members WHERE family_id = v_family AND role = 'parent';
    IF v_parent_count <= 1 THEN
      RETURN json_build_object('ok', false, 'error', 'cannot_delete_last_parent');
    END IF;
  END IF;

  DELETE FROM members WHERE member_id = p_member_id AND family_id = v_family;
  RETURN json_build_object('ok', true);
END $$;

