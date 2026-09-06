/**
 * 저녁 메뉴 이미지-레시피 매칭 및 하이브리드 캐싱 서비스
 *
 * [2026-09-03] 브라우저에서 각 URL을 직접 확인하여 잘못된 이미지를 전면 교체함.
 * 기존 URL 다수가 아보카도 국수·케밥·아보카도 토스트 등 완전히 틀린 음식을 가리키고 있었음.
 */

// ── 테마별 검증된 고화질 음식 사진 아카이브 (브라우저 직접 검증 완료) ──
export const CURATED_FOOD_PHOTOS = {
  // 1. 닭요리 / 백숙 / 삼계탕 (누룽지 백숙 포함) — 삼계탕 뚝배기 ✅
  chicken_soup: 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80',
  // 2. 뚝배기 된장찌개 (된장찌개, 청국장 등) — 차돌박이 & 두부·애호박 가득 뚝배기 차돌된장찌개 (네이버 검증 완료) ✅
  doenjang_jjigae: '/images/doenjang_jjigae.jpg',
  // 2.1 뚝배기 김치찌개 (김치찌개, 부대찌개, 동태찌개 등) — 돼지고기 듬뿍 보글보글 묵은지 김치찌개 뚝배기 (네이버 검증 완료) ✅
  kimchi_jjigae: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg',
  // 2.2 뚝배기 순두부찌개 — 우드 트레이 위 정갈한 뚝배기 순두부찌개 (워터마크 제거 & 클로즈업 완료) ✅
  sundubu_jjigae: '/images/sundubu_jjigae.jpg',
  // 하위 호환용 기본 찌개 (김치찌개 사진으로 설정)
  korean_stew: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAxMDVfMTA4%2FMDAxNjQxMzU0MTAwMDcy.Q9C7tiGVeobbjb_QWWVQAnq43iigry783UfoWNuv0Q4g.a9yZU02dd5B8eU8pt0JClu4n4uBgE3C6GRCp4tLHdAgg.JPEG.melone1225%2FIMG_3026-1.jpg',
  // 3. 따뜻한 떡국 / 만둣국 / 사골국 — 백탁 국물 ✅
  tteokguk_soup: 'https://images.unsplash.com/photo-1562749606-0a9eb5a8a0f3?auto=format&fit=crop&w=800&q=80',
  // 4. 잔치국수 / 칼국수 / 면류 — 소면 국물 ✅
  korean_noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  // 5. 볶음밥 / 김치볶음밥 — 주물팬 가득 노릇하게 볶아낸 반숙 계란 후라이 김치볶음밥 (텍스트 제거 & 클로즈업 완료) ✅
  fried_rice: '/images/kimchi_fried_rice.jpg',
  // 6. 불고기 / 제육볶음 / 삼겹살 / 고기구이 — 한국식 BBQ 그릴 ✅
  korean_meat: 'https://images.unsplash.com/photo-1527578054032-8d8f044e013d?auto=format&fit=crop&w=800&q=80',
  // 7. 생선구이 / 조림 / 해물 — 노릇한 고등어구이 & 뚝배기 된장찌개 백반 (네이버 검증 완료) ✅
  grilled_fish: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjlfMjkg%2FMDAxNjUzNzU0NDc4MDUz.Op6avDaDz2ihAcFOrTQeR5aGCI7eHfCn2OHS8dWpZP8g.LAzOX7JyhUK627ovgQRt_YVJOaDMAnq7vbK-NipOef0g.JPEG.ican211%2F1653754477858.jpg',
  // 8. 비빔밥 — 지글지글 뚝배기 돌솥 나물 비빔밥 (네이버 검증 완료) ✅
  bibimbap: '/images/bibimbap.jpg',
  // 8.1 잡채 — 도자기 접시 위 소고기 야채 궁중 잡채 (네이버 검증 완료) ✅
  japchae: '/images/japchae.jpg',
  // 9. 돈까스 / 튀김 — 돈카츠 ✅
  tonkatsu: 'https://images.unsplash.com/photo-1496112774951-bf41010eed5e?auto=format&fit=crop&w=800&q=80',
  // 10. 파스타 / 스파게티 — 페투치네 ✅
  pasta: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  // 11. 계란말이 / 반찬 — 고소한 모짜렐라 치즈 계란말이 (네이버 검증 완료) ✅
  egg_roll: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDVfNTcg%2FMDAxNjE0OTM1MDAyNTgw.XA3mIa0iH0AdZ9L_za9oXYo8FY4cmLiszSohm6gz_QYg.KUtOvxeKB0sgsbLxGvQ2kGoOba0m5BRY0kUKCLEz3gsg.JPEG.skstbvjcjqj%2FKakaoTalk_20210305_173659069_20.jpg',
  // 12. 카레라이스 — 일본식 카레 ✅
  curry_rice: 'https://images.unsplash.com/photo-1723208841184-3d91ba244c60?auto=format&fit=crop&w=800&q=80',
  // 13. 떡볶이 / 분식 — 찌개류 (붉은 소스) ✅
  tteokbokki: 'https://images.unsplash.com/photo-1760228865341-675704c22a5b?auto=format&fit=crop&w=800&q=80',
  // 14. 오므라이스 — 노란 계란옷에 케첩 지그재그 집밥 오므라이스 (네이버 검증 완료) ✅
  omurice: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMjVfNDAg%2FMDAxNjA2MjU1OTEyNzIx.e_rzPFRFG2CE3nwFbMArEBG0juyvP6rXQ9FKDDWGbDIg.JmYx3thG4csZDKVM_l-iUJkGOTOxTJVLQF-9uF5DEcYg.JPEG.lovetogapyjs%2FIMG_2821.JPG',
  // 15. 소고기미역국 / 미역국 — 뽀얀 국물에 두툼한 양지가 듬뿍 든 소고기미역국 (네이버 검증 완료) ✅
  miyeokguk: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MDRfNzgg%2FMDAxNzgwNTY4NjgzMjM1.TDbC-2o_OEGheJH9u-Ab48Bo3Obnfq64Rkj0EiG-e3gg.1qydX-5pPhz9FSEqs0Fye6AJxCscJz_HkCVS6BV8LUgg.JPEG%2F802260999.962271.jpg',
  // 16. 닭볶음탕 / 닭도리탕 — 냄비 가득 푸짐한 홈메이드 매콤 닭볶음탕 (네이버 검증 완료) ✅
  dakbokkeum: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA1MjRfMzMg%2FMDAxNjg0OTMxMDc3NDc1.3fvQPZWDYGkKyt5gg30AHfkC1gwTfQjIpsH1OhaOVf4g.IL_TBEJ_5KCbj0Ib9F098kqwX7mXQ6inYeanUt6n-rEg.JPEG.onlyuu_%2FKakaoTalk_20230524_211540210_10.jpg',
  // 17. 갈비찜 / 소갈비찜 / 돼지갈비찜 — 냄비 가득 윤기 좔좔 홈메이드 갈비찜 (네이버 검증 완료) ✅
  galbijjim: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjZfMjk4%2FMDAxNjk1NzAzMjAwMjUx.17KJXVWmwt0zyi2wRjtv5TxV3CCM8_wRq17Bn-Z4M24g.Sny4Yg89_8CdH9l2Smcdp8RysERLoSmArR6R66DWBIMg.JPEG.wjdwldbs9999%2FIMG_3052.jpg',
  // 18. 제육볶음 — 매콤달콤 양념에 노릇하게 볶아낸 도자기볼 홈메이드 제육볶음 (네이버 검증 완료) ✅
  jeyuk_bokkeum: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDhfODEg%2FMDAxNjE3ODY5NTAxNTg5.0WXJn8pFWiPGHtDN9hzyL6_oca8iDncAMUPGqtHF9gYg.vA8aOyxNqYCclFtcioaSjLXCRkazfH_rGY4Nvb4Tv5sg.JPEG.peace8012%2FIMG_4081.JPG',
  // 19. 소불고기 / 불고기 / 소불고기 덮밥 — 달콤짭조름 자작한 양념의 밥도둑 홈메이드 소불고기 백반 (네이버 검증 완료) ✅
  bulgogi: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEyMjNfMjU5%2FMDAxNzY2NDg0OTU2Nzc2.vxeG0V8wnuWrDtro80k5QI4tdh_JGK9x4fd4bGfTX0gg.UFtuEg4alI6HDqVyRqEfrw8r_YfuAq-XHQTyfuCM7xcg.JPEG%2Foutput%25A3%25DF264553869.jpg',
  // 20. 참치마요 덮밥 / 마요덮밥 — 포슬포슬 에그스크램블과 참치, 지그재그 마요네즈 덮밥 (네이버 검증 완료) ✅
  tuna_mayo: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA0MTFfMTgy%2FMDAxNzQ0Mzc4NjA4MjU5.us5Id840wyDQ6iWsjw4Ml7t9NkWwxHr7ZYPZlZAGh24g.dwPPOiUiB-TR6IcydbWHHDDkeltXEIeY8NKcbIX2c0Ag.JPEG%2FIMG_5121.JPG',
  // 21. 삼겹살구이 — 불판 위 노릇노릇 구워진 삼겹살 & 김치 구이 (네이버 검증 완료) ✅
  samgyeopsal: '/images/samgyeopsal.jpg',
  // 22. 보쌈 / 수육 — 화이트 접시 위 촉촉한 수육 & 새우젓·쌈장 정갈한 상차림 (네이버 검증 완료) ✅
  bossam_suyuk: '/images/bossam_suyuk.jpg',
  // 23. 두부조림 — 팬 가득 자작하게 조려낸 매콤달콤 밥도둑 홈메이드 두부조림 (네이버 검증 완료) ✅
  tofu_jorim: '/images/tofu_jorim.jpg',
}

// ── 1. 대표 50선 및 자주 쓰이는 메뉴 사전 매핑 ──
export const SEED_MENU_50 = {
  // [찌개/국물류]
  김치찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  '돼지고기 김치찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  '돼지 김치찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  '참치 김치찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  '스팸 김치찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  된장찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.doenjang_jjigae },
  '된장찌개 정식': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.doenjang_jjigae },
  '차돌 된장찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.doenjang_jjigae },
  '해물 된장찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.doenjang_jjigae },
  순두부찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.sundubu_jjigae },
  '해물 순두부찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.sundubu_jjigae },
  '바지락 순두부찌개': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.sundubu_jjigae },
  부대찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  청국장: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.doenjang_jjigae },
  동태찌개: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.kimchi_jjigae },
  삼계탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  '누룽지 백숙': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  누룽지백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  닭백숙: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  닭곰탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  갈비탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  감자탕: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  소고기미역국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.miyeokguk },
  미역국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.miyeokguk },
  소고기무국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  소고기뭇국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  육개장: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.korean_stew },
  콩나물국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  콩나물국밥: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.chicken_soup },
  떡국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },
  떡만둣국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },
  만둣국: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.tteokguk_soup },

  // [고기/구이/볶음류]
  제육볶음: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.jeyuk_bokkeum },
  '돼지고기 제육볶음': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.jeyuk_bokkeum },
  '제육 덮밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.jeyuk_bokkeum },
  제육덮밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.jeyuk_bokkeum },
  소불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  '소불고기 덮밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  소불고기덮밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  '뚝배기 불고기': { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  뚝배기불고기: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  뚝불: { category: '찌개/국물류', image_url: CURATED_FOOD_PHOTOS.bulgogi },
  돼지갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  소갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  매운갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  궁중갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  매운돼지갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  매운소갈비찜: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.galbijjim },
  삼겹살구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.samgyeopsal },
  삼겹살: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.samgyeopsal },
  대패삼겹살: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.samgyeopsal },
  통삼겹구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.samgyeopsal },
  닭볶음탕: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.dakbokkeum },
  닭도리탕: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.dakbokkeum },
  찜닭: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  안동찜닭: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  훈제오리구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  '수육/보쌈': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bossam_suyuk },
  '보쌈/수육': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bossam_suyuk },
  보쌈: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bossam_suyuk },
  수육: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bossam_suyuk },
  돼지고기수육: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.bossam_suyuk },
  족발: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  떡갈비: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  오삼불고기: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  춘천닭갈비: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  LA갈비구이: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  두부조림: { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.tofu_jorim },
  '두부 조림': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.tofu_jorim },
  '매콤 두부조림': { category: '고기/구이/볶음류', image_url: CURATED_FOOD_PHOTOS.tofu_jorim },

  // [해산물류]
  고등어구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  '된장국과 생선구이': { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  생선구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  갈치조림: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  고등어무조림: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  오징어볶음: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  낙지볶음: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  조기구이: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.grilled_fish },
  해물파전: { category: '해산물류', image_url: CURATED_FOOD_PHOTOS.egg_roll },

  // [한그릇/면류]
  비빔밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  돌솥비빔밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  나물비빔밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  육회비빔밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.bibimbap },
  김치볶음밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  볶음밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  '스팸 김치볶음밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.fried_rice },
  '참치마요 덮밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tuna_mayo },
  참치마요덮밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tuna_mayo },
  참치마요: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tuna_mayo },
  치킨마요덮밥: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tuna_mayo },
  카레라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.curry_rice },
  하이라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.curry_rice },
  오므라이스: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.omurice },
  '계란말이와 밥': { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.egg_roll },
  계란말이: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.egg_roll },
  잡채: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.japchae },
  궁중잡채: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.japchae },
  소고기잡채: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.japchae },
  잔치국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  비빔국수: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.korean_noodle },
  떡볶이: { category: '한그릇/면류', image_url: CURATED_FOOD_PHOTOS.tteokbokki },

  // [양식/퓨전]
  돈가스: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.tonkatsu },
  돈까스: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.tonkatsu },
  함박스테이크: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.korean_meat },
  토마토파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  크림파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  알리오올리오: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  파스타: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  스파게티: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.pasta },
  찹스테이크: { category: '양식/퓨전', image_url: CURATED_FOOD_PHOTOS.korean_meat },
}

// ── 3. 카테고리별 Fallback 이미지 ──
export const CATEGORY_FALLBACK_MAP = {
  '찌개/국물류': CURATED_FOOD_PHOTOS.korean_stew,
  '고기/구이/볶음류': CURATED_FOOD_PHOTOS.korean_meat,
  해산물류: CURATED_FOOD_PHOTOS.grilled_fish,
  '한그릇/면류': CURATED_FOOD_PHOTOS.fried_rice,
  '양식/퓨전': CURATED_FOOD_PHOTOS.pasta,
  기본: CURATED_FOOD_PHOTOS.korean_stew,
}

// 런타임 메모리 캐시
const memoryCache = new Map()

/**
 * 키워드 기반 스마트 이미지 매핑 (누룽지 백숙, 떡국, 잔치국수 등 즉시 해결)
 */
function matchFoodPhotoByKeyword(title) {
  if (!title) return null
  const t = title.trim().toLowerCase()

  // 1. 닭/백숙/삼계탕 (누룽지 백숙 포함)
  if (/백숙|누룽지|삼계탕|닭백숙|닭곰탕|닭한마리/.test(t)) {
    return CURATED_FOOD_PHOTOS.chicken_soup
  }

  // 1.5 미역국 / 소고기미역국
  if (/미역국/.test(t)) {
    return CURATED_FOOD_PHOTOS.miyeokguk
  }

  // 2. 떡국 / 만둣국
  if (/떡국|떡만두|만둣국|만두국|사골떡/.test(t)) {
    return CURATED_FOOD_PHOTOS.tteokguk_soup
  }

  // 3. 국수 / 잔치국수 / 칼국수
  if (/잔치국수|국수|소면|칼국수|우동|짬뽕|짜장/.test(t)) {
    return CURATED_FOOD_PHOTOS.korean_noodle
  }

  // 3.5 생선구이 / 생선구이 정식 (된장찌개 포함 시 생선구이 우선)
  if (/된장국과\s*생선구이|생선구이|고등어구이|갈치구이|조기구이/.test(t)) {
    return CURATED_FOOD_PHOTOS.grilled_fish
  }

  // 3.8 닭볶음탕 / 닭도리탕 (찌개/탕보다 먼저 매칭)
  if (/닭볶음|닭도리/.test(t)) {
    return CURATED_FOOD_PHOTOS.dakbokkeum
  }

  // 3.9 갈비찜 (소갈비찜, 돼지갈비찜, 매운갈비찜, 궁중갈비찜 등)
  if (/갈비찜/.test(t)) {
    return CURATED_FOOD_PHOTOS.galbijjim
  }

  // 3.95 제육볶음 / 제육덮밥
  if (/제육/.test(t)) {
    return CURATED_FOOD_PHOTOS.jeyuk_bokkeum
  }

  // 3.96 소불고기 / 불고기 / 소불고기덮밥 / 뚝배기불고기
  if (/소불고기|뚝배기\s*불고기|뚝불|불고기/.test(t)) {
    return CURATED_FOOD_PHOTOS.bulgogi
  }

  // 3.97 삼겹살 / 삼겹살구이 / 대패삼겹살
  if (/삼겹/.test(t)) {
    return CURATED_FOOD_PHOTOS.samgyeopsal
  }

  // 3.98 보쌈 / 수육
  if (/보쌈|수육/.test(t)) {
    return CURATED_FOOD_PHOTOS.bossam_suyuk
  }

  // 3.99 두부조림
  if (/두부조림|두부\s*조림/.test(t)) {
    return CURATED_FOOD_PHOTOS.tofu_jorim
  }

  // 4. 찌개 / 탕 / 뚝배기
  if (/순두부/.test(t)) {
    return CURATED_FOOD_PHOTOS.sundubu_jjigae
  }
  if (/된장|청국장/.test(t)) {
    return CURATED_FOOD_PHOTOS.doenjang_jjigae
  }
  if (/김치찌개|부대찌개|동태찌개|감자탕|육개장|찌개|탕|전골/.test(t)) {
    return CURATED_FOOD_PHOTOS.kimchi_jjigae
  }

  // 5. 볶음밥 / 오므라이스 / 참치마요 / 비빔밥 / 덮밥 / 카레
  if (/오므라이스/.test(t)) {
    return CURATED_FOOD_PHOTOS.omurice
  }
  if (/참치마요|치킨마요|마요덮밥/.test(t)) {
    return CURATED_FOOD_PHOTOS.tuna_mayo
  }
  if (/김치볶음밥|볶음밥/.test(t)) {
    return CURATED_FOOD_PHOTOS.fried_rice
  }
  if (/비빔밥/.test(t)) {
    return CURATED_FOOD_PHOTOS.bibimbap
  }
  if (/잡채/.test(t)) {
    return CURATED_FOOD_PHOTOS.japchae
  }
  if (/카레|하이라이스/.test(t)) {
    return CURATED_FOOD_PHOTOS.curry_rice
  }

  // 6. 고기 / 불고기 / 제육 / 갈비
  if (/불고기|제육|삼겹|갈비|고기|보쌈|수육|족발|닭볶음|찜닭|스테이크|닭갈비/.test(t)) {
    return CURATED_FOOD_PHOTOS.korean_meat
  }

  // 7. 생선 / 해물
  if (/생선|고등어|갈치|조기|오징어|낙지|해물/.test(t)) {
    return CURATED_FOOD_PHOTOS.grilled_fish
  }

  // 8. 파스타 / 돈까스
  if (/파스타|스파게티|알리오/.test(t)) {
    return CURATED_FOOD_PHOTOS.pasta
  }
  if (/돈가스|돈까스/.test(t)) {
    return CURATED_FOOD_PHOTOS.tonkatsu
  }

  // 9. 계란 / 달걀
  if (/계란|달걀|오믈렛/.test(t)) {
    return CURATED_FOOD_PHOTOS.egg_roll
  }

  return null
}

/**
 * [동기식 빠른 반환]
 */
export function getMenuImageSync(menuName) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const raw = menuName.trim()

  if (memoryCache.has(raw)) {
    return memoryCache.get(raw)
  }

  // 1차 완벽 매칭
  if (SEED_MENU_50[raw]) {
    return SEED_MENU_50[raw].image_url
  }

  // 2차 정밀 키워드 스마트 매칭 (누룽지 백숙, 떡국, 잔치국수 등 100% 처리)
  const matched = matchFoodPhotoByKeyword(raw)
  if (matched) {
    return matched
  }

  // 3차 부분 문자열 검색
  for (const [key, item] of Object.entries(SEED_MENU_50)) {
    if (raw.includes(key) || key.includes(raw)) {
      return item.image_url
    }
  }

  return CATEGORY_FALLBACK_MAP.기본
}

/**
 * [비동기 하이브리드 파이프라인 서비스 함수]
 */
export async function getMenuImage(menuName, options = {}) {
  if (!menuName) return CATEGORY_FALLBACK_MAP.기본
  const trimmed = menuName.trim()
  const { supabase, category = '' } = options

  if (memoryCache.has(trimmed)) {
    return memoryCache.get(trimmed)
  }

  // 1. 키워드/사전 매핑에서 즉시 정확한 이미지 획득
  const syncImage = getMenuImageSync(trimmed)
  if (syncImage && syncImage !== CATEGORY_FALLBACK_MAP.기본) {
    memoryCache.set(trimmed, syncImage)
    return syncImage
  }

  // 2. Supabase DB 캐시 확인
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('image_url')
        .eq('name', trimmed)
        .maybeSingle()

      if (!error && data?.image_url) {
        memoryCache.set(trimmed, data.image_url)
        return data.image_url
      }
    } catch (err) {
      console.warn('DB menu_items 조회 에러:', err.message)
    }
  }

  // 3. Fallback
  memoryCache.set(trimmed, syncImage)
  return syncImage
}
