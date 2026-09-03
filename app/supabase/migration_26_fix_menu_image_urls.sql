-- ==============================================================================
-- migration_26_fix_menu_image_urls.sql
-- menu_items 테이블의 잘못된 이미지 URL을 브라우저 검증된 올바른 URL로 교체
-- ==============================================================================

-- 1. photo-1547928576-a4a33237cbc3 (아보카도 국수) → 삼계탕 뚝배기
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1547928576-a4a33237cbc3%';

-- 2. photo-1583032015879-66c3ecfa50b9 (404 깨진 링크) → 김치찌개
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1760228865341-675704c22a5b?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1583032015879-66c3ecfa50b9%';

-- 3. photo-1590301157890-4810ed352733 (비빔밥→고기에 잘못 배정) → 한국식 BBQ 그릴
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1590301157890-4810ed352733%';

-- 4. photo-1604908176997-125f25cc6f3d (닭볶음→돈까스에 잘못 배정) → 실제 돈카츠
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1604908176997-125f25cc6f3d%';

-- 5. photo-1628294895950-9805252327bc (케밥→카레에 잘못 배정) → 일본식 카레라이스
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1628294895950-9805252327bc%';

-- 6. photo-1603133872878-684f208fb84b (볶음밥) → 김치볶음밥 달걀 프라이
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1600688654899-379ec76aca42?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1603133872878-684f208fb84b%';

-- 7. photo-1553163147-622ab57be1c7 (애매한 덮밥→비빔밥에 잘못 배정) → 검증된 비빔밥
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1718777791239-c473e9ce7376?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1553163147-622ab57be1c7%';

-- 8. photo-1525351484163-7529414344d8 (아보카도 토스트→계란말이에 잘못 배정) → 김치볶음밥
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1600688654899-379ec76aca42?auto=format&fit=crop&w=800&q=80', source_type = 'LOCAL' WHERE image_url LIKE '%photo-1525351484163-7529414344d8%';

-- 개별 정밀 업데이트
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80' WHERE name IN ('삼계탕', '누룽지 백숙', '누룽지백숙', '백숙', '닭백숙', '닭곰탕');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1760228865341-675704c22a5b?auto=format&fit=crop&w=800&q=80' WHERE name IN ('김치찌개', '된장찌개', '순두부찌개', '부대찌개', '청국장', '된장찌개 정식');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80' WHERE name IN ('제육볶음', '소불고기', '불고기', '삼겹살구이', '소불고기 덮밥');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1718777791239-c473e9ce7376?auto=format&fit=crop&w=800&q=80' WHERE name IN ('비빔밥');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1600688654899-379ec76aca42?auto=format&fit=crop&w=800&q=80' WHERE name IN ('김치볶음밥', '볶음밥', '오므라이스', '계란말이와 밥');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80' WHERE name IN ('카레라이스', '하이라이스');
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80' WHERE name IN ('돈가스', '돈까스');

SELECT name, image_url FROM menu_items ORDER BY category, name;
