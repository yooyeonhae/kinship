-- ==============================================================================
-- migration_27_fix_fish_and_omurice_images.sql
-- 된장국과 생선구이 및 오므라이스 이미지 한국식 네이버 검증 사진으로 교체
-- ==============================================================================

-- 1. 된장국과 생선구이 / 생선구이 / 고등어구이 (노릇한 고등어구이 & 뚝배기 꽃게 된장찌개 백반)
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('된장국과 생선구이', '생선구이', '고등어구이');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg'
WHERE title IN ('된장국과 생선구이', '생선구이', '고등어구이');

-- 2. 오므라이스 (노란 계란옷에 케첩 지그재그 집밥 오므라이스)
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG',
    source_type = 'LOCAL' 
WHERE name = '오므라이스';

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG'
WHERE title = '오므라이스';

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('된장국과 생선구이', '고등어구이', '오므라이스', '김치볶음밥');
