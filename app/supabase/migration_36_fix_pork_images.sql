-- ==============================================================================
-- migration_36_fix_pork_images.sql
-- 삼겹살구이 및 보쌈/수육 이미지를
-- 네이버 검증 홈메이드 고화질 사진으로 개별 교체
-- ==============================================================================

-- 1. 삼겹살구이 (불판 위 노릇노릇 구워진 삼겹살 & 김치 구이)
UPDATE menu_items 
SET image_url = '/images/samgyeopsal.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('삼겹살구이', '삼겹살', '삼겹살 구이', '대패삼겹살', '대패 삼겹살', '통삼겹구이', '통삼겹 구이');

UPDATE recipes 
SET image_url = '/images/samgyeopsal.jpg'
WHERE title IN ('삼겹살구이', '삼겹살', '삼겹살 구이', '대패삼겹살', '대패 삼겹살', '통삼겹구이', '통삼겹 구이');

-- 2. 보쌈 / 수육 (화이트 접시 위 촉촉한 수육 & 새우젓·쌈장 정갈한 상차림)
UPDATE menu_items 
SET image_url = '/images/bossam_suyuk.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('수육/보쌈', '보쌈/수육', '보쌈', '수육', '돼지고기수육', '돼지고기 수육', '돼지 수육', '삼겹 수육');

UPDATE recipes 
SET image_url = '/images/bossam_suyuk.jpg'
WHERE title IN ('수육/보쌈', '보쌈/수육', '보쌈', '수육', '돼지고기수육', '돼지고기 수육', '돼지 수육', '삼겹 수육');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('삼겹살구이', '보쌈', '수육');
