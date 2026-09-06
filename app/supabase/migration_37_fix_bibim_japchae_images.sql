-- ==============================================================================
-- migration_37_fix_bibim_japchae_images.sql
-- 비빔밥 및 잡채 이미지를
-- 네이버 검증 홈메이드 고화질 사진으로 개별 교체
-- ==============================================================================

-- 1. 비빔밥 (지글지글 뚝배기 돌솥 나물 비빔밥)
UPDATE menu_items 
SET image_url = '/images/bibimbap.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('비빔밥', '돌솥비빔밥', '돌솥 비빔밥', '나물비빔밥', '나물 비빔밥', '육회비빔밥', '육회 비빔밥', '산채비빔밥', '산채 비빔밥', '전주비빔밥', '전주 비빔밥');

UPDATE recipes 
SET image_url = '/images/bibimbap.jpg'
WHERE title IN ('비빔밥', '돌솥비빔밥', '돌솥 비빔밥', '나물비빔밥', '나물 비빔밥', '육회비빔밥', '육회 비빔밥', '산채비빔밥', '산채 비빔밥', '전주비빔밥', '전주 비빔밥');

-- 2. 잡채 (도자기 접시 위 소고기 야채 궁중 잡채)
UPDATE menu_items 
SET image_url = '/images/japchae.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('잡채', '궁중잡채', '궁중 잡채', '소고기잡채', '소고기 잡채', '당면잡채', '소고기 당면 잡채');

UPDATE recipes 
SET image_url = '/images/japchae.jpg'
WHERE title IN ('잡채', '궁중잡채', '궁중 잡채', '소고기잡채', '소고기 잡채', '당면잡채', '소고기 당면 잡채');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('비빔밥', '돌솥비빔밥', '잡채');
