-- ==============================================================================
-- migration_25_menu_items.sql
-- 저녁 메뉴 이미지-레시피 매칭 및 하이브리드 캐싱 테이블 & 대표 50선 시드 데이터
-- ==============================================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,          -- 메뉴 한글명 (예: '삼계탕')
    category VARCHAR(30),                       -- 카테고리 (찌개/국물류, 고기/구이/볶음류 등)
    search_keyword VARCHAR(150),                -- 외부 이미지 검색용 최적화 영문 키워드
    image_url TEXT,                             -- 이미지 URL (null인 경우 외부 검색 트리거)
    source_type VARCHAR(20) DEFAULT 'LOCAL',    -- 'LOCAL', 'EXTERNAL_CACHED', 'FALLBACK'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 활성화 및 익명(anon) 접근 정책 설정
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_items_all" ON menu_items;
CREATE POLICY "menu_items_all"
ON menu_items FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- 3. 검색 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- ==============================================================================
-- 4. 대표 저녁 메뉴 50선 시드(Seed) 데이터 구축
-- ==============================================================================

INSERT INTO menu_items (name, category, search_keyword, image_url, source_type) VALUES
-- [찌개/국물류 (12종)]
('김치찌개', '찌개/국물류', 'Kimchi jjigae stew', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('된장찌개', '찌개/국물류', 'Doenjang jjigae korean stew', 'https://images.unsplash.com/photo-1583032015879-66c3ecfa50b9?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('순두부찌개', '찌개/국물류', 'Sundubu jjigae soft tofu stew', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('부대찌개', '찌개/국물류', 'Budae jjigae army stew', 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('청국장', '찌개/국물류', 'Cheonggukjang fermented soybean stew', 'https://images.unsplash.com/photo-1583032015879-66c3ecfa50b9?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('삼계탕', '찌개/국물류', 'Samgyetang korean ginseng chicken', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('갈비탕', '찌개/국물류', 'Galbitang short rib soup', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('감자탕', '찌개/국물류', 'Gamjatang pork bone soup', 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('소고기미역국', '찌개/국물류', 'Korean seaweed soup beef', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('소고기무국', '찌개/국물류', 'Korean beef radish soup', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('육개장', '찌개/국물류', 'Yukgaejang spicy beef soup', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('콩나물국', '찌개/국물류', 'Kongnamul guk soybean sprout soup', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

-- [고기/구이/볶음류 (14종)]
('제육볶음', '고기/구이/볶음류', 'Jeyuk bokkeum spicy pork', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('소불고기', '고기/구이/볶음류', 'Korean beef bulgogi', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('돼지갈비찜', '고기/구이/볶음류', 'Korean braised pork ribs', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('소갈비찜', '고기/구이/볶음류', 'Galbijjim braised beef short ribs', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('삼겹살구이', '고기/구이/볶음류', 'Samgyeopsal grilled pork belly', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('닭볶음탕', '고기/구이/볶음류', 'Dakbokkeumtang spicy chicken stew', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('찜닭', '고기/구이/볶음류', 'Andong jjimdak braised chicken', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('훈제오리구이', '고기/구이/볶음류', 'Smoked duck vegetable stir fry', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('수육/보쌈', '고기/구이/볶음류', 'Bossam boiled pork belly korean', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('족발', '고기/구이/볶음류', 'Jokbal korean braised pigs trotters', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('떡갈비', '고기/구이/볶음류', 'Tteokgalbi grilled minced short ribs', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('오삼불고기', '고기/구이/볶음류', 'Squid and pork belly stir fry', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('춘천닭갈비', '고기/구이/볶음류', 'Dakgalbi spicy stir fried chicken', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('LA갈비구이', '고기/구이/볶음류', 'LA galbi grilled marinated ribs', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

-- [해산물류 (8종)]
('고등어구이', '해산물류', 'Grilled mackerel fish', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('갈치조림', '해산물류', 'Braised hairtail fish korean', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('고등어무조림', '해산물류', 'Braised mackerel with radish', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('오징어볶음', '해산물류', 'Ojingeo bokkeum spicy squid', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('낙지볶음', '해산물류', 'Nakji bokkeum spicy octopus', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('조기구이', '해산물류', 'Grilled yellow croaker', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('해물파전', '해산물류', 'Haemul pajeon seafood pancake', 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('동태찌개', '해산물류', 'Pollack fish stew korean', 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

-- [한그릇/면류 (10종)]
('비빔밥', '한그릇/면류', 'Bibimbap korean mixed rice', 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('김치볶음밥', '한그릇/면류', 'Kimchi fried rice with egg', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('카레라이스', '한그릇/면류', 'Japanese curry rice dish', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('하이라이스', '한그릇/면류', 'Hayashi rice hash beef', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('오므라이스', '한그릇/면류', 'Omurice omelette rice', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG', 'LOCAL'),
('잡채', '한그릇/면류', 'Japchae korean glass noodles', 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('잔치국수', '한그릇/면류', 'Janchi guksu warm banquet noodles', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('비빔국수', '한그릇/면류', 'Bibim guksu spicy cold noodles', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('떡볶이', '한그릇/면류', 'Tteokbokki spicy rice cakes', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('만둣국', '한그릇/면류', 'Manduguk korean dumpling soup', 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

('돈가스', '양식/퓨전', 'Tonkatsu pork cutlet platter', 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('함박스테이크', '양식/퓨전', 'Hamburg steak patty egg', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('토마토파스타', '양식/퓨전', 'Tomato spaghetti pasta basil', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('크림파스타', '양식/퓨전', 'Cream sauce fettuccine pasta', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('알리오올리오', '양식/퓨전', 'Aglio e olio garlic olive oil pasta', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('찹스테이크', '양식/퓨전', 'Chop steak bite size beef vegetables', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'LOCAL'),

-- [기본 레시피 세트 명칭 보강]
('된장찌개 정식', '찌개/국물류', 'Doenjang jjigae korean stew set', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('소불고기 덮밥', '고기/구이/볶음류', 'Korean beef bulgogi rice bowl', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('계란말이와 밥', '한그릇/면류', 'Gyeran mari rolled omelette with rice', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('참치마요 덮밥', '한그릇/면류', 'Tuna mayo rice bowl', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('콩나물국밥', '찌개/국물류', 'Kongnamul gukbap bean sprout soup with rice', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('두부조림', '고기/구이/볶음류', 'Dubu jorim braised tofu', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', 'LOCAL'),
('된장국과 생선구이', '해산물류', 'Grilled fish with soybean soup set', 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg', 'LOCAL'),
('떡국', '찌개/국물류', 'Tteokguk korean sliced rice cake soup', 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80', 'LOCAL')

ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  search_keyword = EXCLUDED.search_keyword,
  image_url = EXCLUDED.image_url,
  source_type = EXCLUDED.source_type;
