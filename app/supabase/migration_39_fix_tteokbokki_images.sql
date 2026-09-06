-- ==============================================================================
-- migration_39_fix_tteokbokki_images.sql
-- 떡볶이 및 분식 이미지를
-- 네이버 검증 홈메이드 고화질 사진(/images/tteokbokki.jpg)으로 교체
-- ==============================================================================

-- 1. 떡볶이 (화이트 볼에 소복이 담긴 정갈한 쌀떡볶이)
UPDATE menu_items 
SET image_url = '/images/tteokbokki.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('떡볶이', '국물 떡볶이', '국물떡볶이', '쌀 떡볶이', '쌀떡볶이', '라볶이', '치즈떡볶이', '치즈 떡볶이', '분식 떡볶이', '궁중떡볶이', '기름떡볶이');

UPDATE recipes 
SET image_url = '/images/tteokbokki.jpg'
WHERE title IN ('떡볶이', '국물 떡볶이', '국물떡볶이', '쌀 떡볶이', '쌀떡볶이', '라볶이', '치즈떡볶이', '치즈 떡볶이', '분식 떡볶이', '궁중떡볶이', '기름떡볶이');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('떡볶이', '국물떡볶이', '라볶이');
