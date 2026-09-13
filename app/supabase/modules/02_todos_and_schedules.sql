-- ==============================================================================
-- Kinship Module 2: Todos, Schedules & Rewards (할일, 보상, 스케줄, 지정복, 퀵태스크)
-- File: app/supabase/modules/02_todos_and_schedules.sql
-- ==============================================================================

-- 1. 테이블 정의

-- (1) 등교 룩북 요일별 규칙 테이블 (weekly_outfit_rules)
CREATE TABLE IF NOT EXISTS weekly_outfit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('월', '화', '수', '목', '금', '토', '일')),
  outfit_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, day_of_week)
);

-- (2) 오늘의 할 일 테이블 (todos)
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

-- (3) 퀵 태스크 템플릿 (quick_tasks)
CREATE TABLE IF NOT EXISTS quick_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  star_reward INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (4) 보상 및 리워드 상점 (rewards)
CREATE TABLE IF NOT EXISTS rewards (
  reward_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  star_cost INT NOT NULL DEFAULT 10,
  icon TEXT DEFAULT '🎁',
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_by UUID REFERENCES members (member_id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (5) 가족 공유 캘린더 일정 (schedules)
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

-- 2. RLS 정책 설정
ALTER TABLE weekly_outfit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- weekly_outfit_rules 정책
DROP POLICY IF EXISTS "weekly_outfit_rules_select" ON weekly_outfit_rules;
CREATE POLICY "weekly_outfit_rules_select" ON weekly_outfit_rules
  FOR SELECT USING (EXISTS (SELECT 1 FROM members WHERE member_id = weekly_outfit_rules.member_id AND family_id = current_family_id()));

DROP POLICY IF EXISTS "weekly_outfit_rules_write_parent" ON weekly_outfit_rules;
CREATE POLICY "weekly_outfit_rules_write_parent" ON weekly_outfit_rules
  FOR ALL USING (EXISTS (SELECT 1 FROM members WHERE member_id = weekly_outfit_rules.member_id AND family_id = current_family_id()) AND is_parent());

-- todos 정책
DROP POLICY IF EXISTS "todos_select_own" ON todos;
CREATE POLICY "todos_select_own" ON todos FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "todos_insert_parent" ON todos;
CREATE POLICY "todos_insert_parent" ON todos FOR INSERT WITH CHECK (family_id = current_family_id() AND is_parent());

DROP POLICY IF EXISTS "todos_update_parent" ON todos;
CREATE POLICY "todos_update_parent" ON todos FOR UPDATE USING (family_id = current_family_id() AND is_parent());

DROP POLICY IF EXISTS "todos_delete_parent" ON todos;
CREATE POLICY "todos_delete_parent" ON todos FOR DELETE USING (family_id = current_family_id() AND is_parent());

-- quick_tasks 정책
DROP POLICY IF EXISTS "quick_tasks_select_own" ON quick_tasks;
CREATE POLICY "quick_tasks_select_own" ON quick_tasks FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "quick_tasks_write_parent" ON quick_tasks;
CREATE POLICY "quick_tasks_write_parent" ON quick_tasks FOR ALL USING (family_id = current_family_id() AND is_parent());

-- rewards 정책
DROP POLICY IF EXISTS "rewards_select_own" ON rewards;
CREATE POLICY "rewards_select_own" ON rewards FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "rewards_write_parent" ON rewards;
CREATE POLICY "rewards_write_parent" ON rewards FOR ALL USING (family_id = current_family_id() AND is_parent());

-- schedules 정책
DROP POLICY IF EXISTS "schedules_select_own" ON schedules;
CREATE POLICY "schedules_select_own" ON schedules FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "schedules_write_parent" ON schedules;
CREATE POLICY "schedules_write_parent" ON schedules FOR ALL USING (family_id = current_family_id() AND is_parent());

-- 3. RPC 함수 정의 (타입 충돌 방지용 DROP FUNCTION CASCADE)
DROP FUNCTION IF EXISTS toggle_my_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS approve_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS add_my_todo(TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_my_todo(UUID) CASCADE;
DROP FUNCTION IF EXISTS purge_old_todos() CASCADE;

-- (1) 자녀 완료 토글 RPC
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

-- (2) 부모 할 일 승인/도장 RPC
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

-- (3) 자녀 스스로 할 일 추가 RPC
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

-- (4) 자녀 본인 생성 할 일 삭제 RPC
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

-- (5) 오래된 할 일 정리 RPC
CREATE OR REPLACE FUNCTION purge_old_todos()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_family UUID := current_family_id();
  v_days   INT;
  v_count  INT;
BEGIN
  IF v_family IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(todo_keep_days, 30) INTO v_days FROM family_settings WHERE family_id = v_family;
  IF v_days <= 0 THEN RETURN 0; END IF;

  DELETE FROM todos
    WHERE family_id = v_family
      AND NOT is_done
      AND due_date < current_date - v_days;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_family_due ON todos(family_id, due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_family_member ON schedules(family_id, member_id);
CREATE INDEX IF NOT EXISTS idx_schedules_family_date ON schedules(family_id, schedule_date);
