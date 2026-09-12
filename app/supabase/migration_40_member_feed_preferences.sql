-- migration_40_member_feed_preferences.sql
-- 개인별 맞춤 정보 피드 카테고리 영구 저장 테이블

CREATE TABLE IF NOT EXISTS member_feed_preferences (
  member_id UUID PRIMARY KEY REFERENCES members (member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE member_feed_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_feed_preferences_all" ON member_feed_preferences;
CREATE POLICY "member_feed_preferences_all" ON member_feed_preferences
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
