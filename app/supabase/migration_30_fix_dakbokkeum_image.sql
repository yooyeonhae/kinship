-- ==============================================================================
-- migration_30_fix_dakbokkeum_image.sql
-- 닭볶음탕 / 닭도리탕 이미지를 네이버 검증 홈메이드 매콤 닭볶음탕 고화질 사진으로 교체
-- ==============================================================================

UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA1MjRfMzMg%2FMDAxNjg0OTMxMDc3NDc1.3fvQPZWDYGkKyt5gg30AHfkC1gwTfQjIpsH1OhaOVf4g.IL_TBEJ_5KCbj0Ib9F098kqwX7mXQ6inYeanUt6n-rEg.JPEG.onlyuu_%2FKakaoTalk_20230524_211540210_10.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('닭볶음탕', '닭도리탕');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA1MjRfMzMg%2FMDAxNjg0OTMxMDc3NDc1.3fvQPZWDYGkKyt5gg30AHfkC1gwTfQjIpsH1OhaOVf4g.IL_TBEJ_5KCbj0Ib9F098kqwX7mXQ6inYeanUt6n-rEg.JPEG.onlyuu_%2FKakaoTalk_20230524_211540210_10.jpg'
WHERE title IN ('닭볶음탕', '닭도리탕');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('닭볶음탕', '닭도리탕');
