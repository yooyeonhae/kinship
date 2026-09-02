-- migration_24_wardrobe_items.sql
-- 아이들 옷장 등록 및 의류 카테고리/종류 메타데이터 테이블

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  member_id uuid NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  category text,       -- 상의, 하의, 아우터, 원피스, 교복/체육복, 기타
  clothing_type text,  -- 반팔, 긴팔, 치마, 원피스, 체육복, 점퍼, 바람막이, 가디건, 코트, 교복 등
  custom_name text,    -- 직접 기입한 이름이나 추가 메모
  ai_confidence float,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

-- 익명 키(anon) 읽기/쓰기/삭제 정책
DROP POLICY IF EXISTS "wardrobe_items_all" ON wardrobe_items;
CREATE POLICY "wardrobe_items_all"
ON wardrobe_items FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_member ON wardrobe_items(member_id, category, clothing_type);
