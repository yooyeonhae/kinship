-- ==============================================================================
-- migration_31_fix_galbijjim_image.sql
-- 갈비찜 / 소갈비찜 / 돼지갈비찜 / 매운갈비찜 / 궁중갈비찜 이미지를
-- 네이버 검증 윤기 좔좔 냄비 홈메이드 갈비찜 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjZfMjk4%2FMDAxNjk1NzAzMjAwMjUx.17KJXVWmwt0zyi2wRjtv5TxV3CCM8_wRq17Bn-Z4M24g.Sny4Yg89_8CdH9l2Smcdp8RysERLoSmArR6R66DWBIMg.JPEG.wjdwldbs9999%2FIMG_3052.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('갈비찜', '소갈비찜', '돼지갈비찜', '매운갈비찜', '궁중갈비찜', '매운돼지갈비찜', '매운소갈비찜');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjZfMjk4%2FMDAxNjk1NzAzMjAwMjUx.17KJXVWmwt0zyi2wRjtv5TxV3CCM8_wRq17Bn-Z4M24g.Sny4Yg89_8CdH9l2Smcdp8RysERLoSmArR6R66DWBIMg.JPEG.wjdwldbs9999%2FIMG_3052.jpg'
WHERE title IN ('갈비찜', '소갈비찜', '돼지갈비찜', '매운갈비찜', '궁중갈비찜', '매운돼지갈비찜', '매운소갈비찜');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('갈비찜', '소갈비찜', '돼지갈비찜', '매운갈비찜', '궁중갈비찜');
