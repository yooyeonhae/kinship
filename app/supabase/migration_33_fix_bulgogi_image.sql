-- ==============================================================================
-- migration_33_fix_bulgogi_image.sql
-- 소불고기 / 불고기 / 소불고기 덮밥 / 뚝배기불고기 이미지를
-- 네이버 검증 달콤짭조름 자작한 홈메이드 소불고기 백반 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEyMjNfMjU5%2FMDAxNzY2NDg0OTU2Nzc2.vxeG0V8wnuWrDtro80k5QI4tdh_JGK9x4fd4bGfTX0gg.UFtuEg4alI6HDqVyRqEfrw8r_YfuAq-XHQTyfuCM7xcg.JPEG%2Foutput%25A3%25DF264553869.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('소불고기', '불고기', '소불고기 덮밥', '소불고기덮밥', '뚝배기불고기', '뚝배기 불고기', '뚝불');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEyMjNfMjU5%2FMDAxNzY2NDg0OTU2Nzc2.vxeG0V8wnuWrDtro80k5QI4tdh_JGK9x4fd4bGfTX0gg.UFtuEg4alI6HDqVyRqEfrw8r_YfuAq-XHQTyfuCM7xcg.JPEG%2Foutput%25A3%25DF264553869.jpg'
WHERE title IN ('소불고기', '불고기', '소불고기 덮밥', '소불고기덮밥', '뚝배기불고기', '뚝배기 불고기', '뚝불');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('소불고기', '불고기', '소불고기 덮밥');
