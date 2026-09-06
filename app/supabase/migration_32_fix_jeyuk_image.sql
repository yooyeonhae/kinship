-- ==============================================================================
-- migration_32_fix_jeyuk_image.sql
-- 제육볶음 / 돼지고기 제육볶음 / 제육덮밥 이미지를
-- 네이버 검증 매콤달콤 도자기볼 홈메이드 제육볶음 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDhfODEg%2FMDAxNjE3ODY5NTAxNTg5.0WXJn8pFWiPGHtDN9hzyL6_oca8iDncAMUPGqtHF9gYg.vA8aOyxNqYCclFtcioaSjLXCRkazfH_rGY4Nvb4Tv5sg.JPEG.peace8012%2FIMG_4081.JPG',
    source_type = 'LOCAL' 
WHERE name IN ('제육볶음', '돼지고기 제육볶음', '제육덮밥', '제육 덮밥', '제육 볶음');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDhfODEg%2FMDAxNjE3ODY5NTAxNTg5.0WXJn8pFWiPGHtDN9hzyL6_oca8iDncAMUPGqtHF9gYg.vA8aOyxNqYCclFtcioaSjLXCRkazfH_rGY4Nvb4Tv5sg.JPEG.peace8012%2FIMG_4081.JPG'
WHERE title IN ('제육볶음', '돼지고기 제육볶음', '제육덮밥', '제육 덮밥', '제육 볶음');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('제육볶음', '돼지고기 제육볶음', '제육덮밥');
