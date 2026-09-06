-- ==============================================================================
-- migration_38_fix_tofu_images.sql
-- 두부조림 이미지를
-- 네이버 검증 홈메이드 고화질 사진(/images/tofu_jorim.jpg)으로 교체
-- ==============================================================================

-- 1. 두부조림 (팬 가득 자작하게 조려낸 백종원식 매콤 두부조림)
UPDATE menu_items 
SET image_url = '/images/tofu_jorim.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('두부조림', '두부 조림', '매콤 두부조림', '매콤두부조림', '백종원 두부조림', '두부양념조림', '두부조림 정식');

UPDATE recipes 
SET image_url = '/images/tofu_jorim.jpg'
WHERE title IN ('두부조림', '두부 조림', '매콤 두부조림', '매콤두부조림', '백종원 두부조림', '두부양념조림', '두부조림 정식');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('두부조림', '두부 조림');
