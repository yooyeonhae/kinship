-- ==============================================================================
-- migration_28_fix_eggroll_image.sql
-- 계란말이 이미지를 네이버 검증 치즈 계란말이 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('계란말이', '계란말이와 밥');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg'
WHERE title IN ('계란말이', '계란말이와 밥');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('계란말이', '계란말이와 밥');
