-- ==============================================================================
-- migration_34_fix_kimchi_and_tunamayo_images.sql
-- 김치볶음밥 / 볶음밥 / 스팸 김치볶음밥 / 참치마요 덮밥 이미지를
-- 네이버 검증 홈메이드 고화질 사진으로 교체
-- ==============================================================================

-- 1. 김치볶음밥 / 볶음밥
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA5MjRfMTI0%2FMDAxNzU4Njg5Njc4NzU5.yI2GLzjktfmOX3mXxKCv_gWkqu98rh35DnmHT96qGCcg.MJTrtIkyfHIjNaPBv6j2GpBy6wdnaJsOCbrg740UDgkg.JPEG%2FKC_TX_77001799_D2215.jpg',
    source_type = 'LOCAL' 
WHERE name IN ('김치볶음밥', '볶음밥', '스팸 김치볶음밥', '스팸김치볶음밥');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA5MjRfMTI0%2FMDAxNzU4Njg5Njc4NzU5.yI2GLzjktfmOX3mXxKCv_gWkqu98rh35DnmHT96qGCcg.MJTrtIkyfHIjNaPBv6j2GpBy6wdnaJsOCbrg740UDgkg.JPEG%2FKC_TX_77001799_D2215.jpg'
WHERE title IN ('김치볶음밥', '볶음밥', '스팸 김치볶음밥', '스팸김치볶음밥');

-- 2. 참치마요 덮밥 / 마요덮밥
UPDATE menu_items 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA0MTFfMTgy%2FMDAxNzQ0Mzc4NjA4MjU5.us5Id840wyDQ6iWsjw4Ml7t9NkWwxHr7ZYPZlZAGh24g.dwPPOiUiB-TR6IcydbWHHDDkeltXEIeY8NKcbIX2c0Ag.JPEG%2FIMG_5121.JPG',
    source_type = 'LOCAL' 
WHERE name IN ('참치마요 덮밥', '참치마요덮밥', '참치마요', '치킨마요덮밥', '치킨마요 덮밥');

UPDATE recipes 
SET image_url = 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA0MTFfMTgy%2FMDAxNzQ0Mzc4NjA4MjU5.us5Id840wyDQ6iWsjw4Ml7t9NkWwxHr7ZYPZlZAGh24g.dwPPOiUiB-TR6IcydbWHHDDkeltXEIeY8NKcbIX2c0Ag.JPEG%2FIMG_5121.JPG'
WHERE title IN ('참치마요 덮밥', '참치마요덮밥', '참치마요', '치킨마요덮밥', '치킨마요 덮밥');

-- 결과 확인
SELECT name, category, image_url FROM menu_items WHERE name IN ('김치볶음밥', '참치마요 덮밥');
