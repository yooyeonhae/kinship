-- ==============================================================================
-- migration_29_fix_miyeokguk_image.sql
-- 소고기미역국 / 미역국 이미지를 네이버 검증 한우 소고기미역국 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MDRfNzgg%2FMDAxNzgwNTY4NjgzMjM1.TDbC-2o_OEGheJH9u-Ab48Bo3Obnfq64Rkj0EiG-e3gg.1qydX-5pPhz9FSEqs0Fye6AJxCscJz_HkCVS6BV8LUgg.JPEG%2F802260999.962271.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('소고기미역국', '미역국');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MDRfNzgg%2FMDAxNzgwNTY4NjgzMjM1.TDbC-2o_OEGheJH9u-Ab48Bo3Obnfq64Rkj0EiG-e3gg.1qydX-5pPhz9FSEqs0Fye6AJxCscJz_HkCVS6BV8LUgg.JPEG%2F802260999.962271.jpg'
WHERE title IN ('소고기미역국', '미역국');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('소고기미역국', '미역국');
