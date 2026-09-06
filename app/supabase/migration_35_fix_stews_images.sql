-- ==============================================================================
-- migration_35_fix_stews_images.sql
-- 된장찌개 / 김치찌개 / 순두부찌개 등 찌개류 이미지를
-- 네이버 검증 홈메이드 고화질 사진으로 개별 교체
-- ==============================================================================

-- 1. 된장찌개 / 청국장 (뚝배기 시골 된장찌개)
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjRfMjAx%2FMDAxNjUzMzU5NzMyMTA1.JBLegAt9QKmkaAarA_s3QjN1HrUJ0uYseihlf7NZnDEg.dImxpZBLOoW_LXPwvtlXTXSA6G-C_I8VwEbWjtu0s0Ag.JPEG.ddalgi00001%2FIMG_9578.JPG',
    source_type = 'LOCAL' 
WHERE name IN ('된장찌개', '된장찌개 정식', '차돌 된장찌개', '차돌된장찌개', '해물 된장찌개', '해물된장찌개', '청국장');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjRfMjAx%2FMDAxNjUzMzU5NzMyMTA1.JBLegAt9QKmkaAarA_s3QjN1HrUJ0uYseihlf7NZnDEg.dImxpZBLOoW_LXPwvtlXTXSA6G-C_I8VwEbWjtu0s0Ag.JPEG.ddalgi00001%2FIMG_9578.JPG'
WHERE title IN ('된장찌개', '된장찌개 정식', '차돌 된장찌개', '차돌된장찌개', '해물 된장찌개', '해물된장찌개', '청국장');

-- 2. 김치찌개 및 찌개류 (돼지고기 듬뿍 묵은지 김치찌개)
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('김치찌개', '돼지고기 김치찌개', '돼지고기김치찌개', '돼지 김치찌개', '돼지김치찌개', '참치 김치찌개', '참치김치찌개', '스팸 김치찌개', '스팸김치찌개', '부대찌개', '동태찌개', '감자탕', '육개장');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg'
WHERE title IN ('김치찌개', '돼지고기 김치찌개', '돼지고기김치찌개', '돼지 김치찌개', '돼지김치찌개', '참치 김치찌개', '참치김치찌개', '스팸 김치찌개', '스팸김치찌개', '부대찌개', '동태찌개', '감자탕', '육개장');

-- 3. 순두부찌개 (얼큰 해물 순두부찌개 & 계란 노른자)
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fcafefiles.naver.net%2F20160222_118%2Fukyosun_1456141214887GqTx6_JPEG%2FDSC_0001.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('순두부찌개', '해물 순두부찌개', '해물순두부찌개', '바지락 순두부찌개', '바지락순두부찌개');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fcafefiles.naver.net%2F20160222_118%2Fukyosun_1456141214887GqTx6_JPEG%2FDSC_0001.jpg'
WHERE title IN ('순두부찌개', '해물 순두부찌개', '해물순두부찌개', '바지락 순두부찌개', '바지락순두부찌개');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('된장찌개', '김치찌개', '순두부찌개');
