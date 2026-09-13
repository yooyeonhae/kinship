-- ==============================================================================
-- Kinship Module 4: Lifestyle & Feed (식단, 레시피, 저녁메뉴 50선, AI 옷장, 맞춤 피드)
-- File: app/supabase/modules/04_lifestyle_and_feed.sql
-- ==============================================================================

-- 1. 테이블 정의

-- (1) 가족 레시피 (recipes)
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

-- (2) 즐겨찾기 링크 (favorite_links)
CREATE TABLE IF NOT EXISTS favorite_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  platform TEXT NOT NULL CHECK (platform IN ('유튜브', '쇼츠', '인스타', '쿠팡', '마켓컬리', 'SSG', '네이버쇼핑', '기타')),
  url TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'video',
  thumbnail_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (3) 등교 룩북 옷장 아이템 (wardrobe_items)
CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  member_id UUID REFERENCES members (member_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  clothing_type TEXT,
  custom_name TEXT,
  storage_path TEXT,
  public_url TEXT,
  ai_confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (4) 저녁 메뉴 이미지 매칭 및 하이브리드 캐싱 (menu_items - 50선)
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(30),
  search_keyword VARCHAR(100),
  image_url TEXT,
  source_type VARCHAR(20) DEFAULT 'UNSPLASH',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- (5) 개인별 맞춤 정보 피드 카테고리 (member_feed_preferences)
CREATE TABLE IF NOT EXISTS member_feed_preferences (
  member_id UUID PRIMARY KEY REFERENCES members (member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families (family_id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS 정책 설정
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_feed_preferences ENABLE ROW LEVEL SECURITY;

-- recipes 정책 (공용 null 또는 내 가족 레시피 조회, 쓰기는 부모만)
DROP POLICY IF EXISTS "recipes_select_family_or_common" ON recipes;
CREATE POLICY "recipes_select_family_or_common" ON recipes
  FOR SELECT USING (family_id IS NULL OR family_id = current_family_id());

DROP POLICY IF EXISTS "recipes_write_parent" ON recipes;
CREATE POLICY "recipes_write_parent" ON recipes
  FOR ALL USING (family_id = current_family_id() AND is_parent());

-- favorite_links 정책
DROP POLICY IF EXISTS "favorite_links_select_own" ON favorite_links;
CREATE POLICY "favorite_links_select_own" ON favorite_links
  FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "favorite_links_write_parent" ON favorite_links;
CREATE POLICY "favorite_links_write_parent" ON favorite_links
  FOR ALL USING (family_id = current_family_id() AND is_parent());

-- wardrobe_items 정책
DROP POLICY IF EXISTS "wardrobe_items_select" ON wardrobe_items;
CREATE POLICY "wardrobe_items_select" ON wardrobe_items
  FOR SELECT USING (family_id = current_family_id());

DROP POLICY IF EXISTS "wardrobe_items_all" ON wardrobe_items;
CREATE POLICY "wardrobe_items_all" ON wardrobe_items
  FOR ALL USING (family_id = current_family_id()) WITH CHECK (family_id = current_family_id());

-- menu_items 정책 (전체 조회 가능)
DROP POLICY IF EXISTS "menu_items_select_all" ON menu_items;
CREATE POLICY "menu_items_select_all" ON menu_items FOR SELECT USING (true);

-- member_feed_preferences 정책
DROP POLICY IF EXISTS "member_feed_preferences_all" ON member_feed_preferences;
CREATE POLICY "member_feed_preferences_all" ON member_feed_preferences
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_recipes_family ON recipes(family_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- 4. 대표 저녁 메뉴 50선 시드 데이터 (검증된 고화질 홈메이드 이미지 반영)
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

-- 5. 기본 공용 레시피 (14종) 시드 데이터
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
