-- migration_12 — 레시피 본문(조리 순서)
--
-- 지금 recipes에는 description 한 칸뿐이라 "재료 / 한 줄 설명"까지가 한계였다.
-- 카드를 눌러 실제로 따라 할 수 있는 레시피를 보여주려면 조리 순서가 들어갈 자리가 있어야 한다.
--
-- 단계를 배열이나 별도 테이블로 쪼개지 않고 여러 줄 텍스트 한 칸으로 두는 이유:
-- 이 앱에서 단계를 하나씩 뒤집거나 개별로 조회할 일이 없고, 입력도 부모가 한 번에
-- 적어 넣는 형태다. 화면에서 줄바꿈으로 나눠 번호를 붙이면 충분하다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table recipes
  add column if not exists steps text;

alter table recipes
  drop constraint if exists recipes_steps_check;

alter table recipes
  add constraint recipes_steps_check
  check (steps is null or length(steps) <= 4000);

-- 기본 레시피에도 조리 순서를 채운다. 카드를 눌렀는데 "조리법이 없어요"만 나오면
-- 기능이 있는지 없는지 알 수 없다.
update recipes set steps = '재료를 먹기 좋은 크기로 썰어요.
냄비에 물 2컵을 붓고 된장 1큰술을 풀어요.
감자와 애호박을 넣고 5분 끓여요.
두부와 대파를 넣고 2분 더 끓이면 완성이에요.'
where family_id is null and title = '된장찌개 정식' and steps is null;

update recipes set steps = '양파와 당근을 얇게 채 썰어요.
팬에 기름을 두르고 소불고기를 볶아요.
고기 색이 변하면 채소를 넣고 함께 볶아요.
간장 1큰술로 간을 맞추고 밥 위에 올려요.'
where family_id is null and title = '소불고기 덮밥' and steps is null;

update recipes set steps = '묵은지를 잘게 썰어 기름에 먼저 볶아요.
신맛이 날아가면 찬밥을 넣고 눌러가며 볶아요.
참기름을 두르고 불을 꺼요.
달걀프라이를 올려 완성해요.'
where family_id is null and title = '김치볶음밥' and steps is null;

update recipes set steps = '달걀 3개를 풀고 소금을 조금 넣어요.
당근과 쪽파를 잘게 다져 섞어요.
약한 불에서 얇게 부어 조금씩 말아요.
한 김 식힌 뒤 썰어야 모양이 유지돼요.'
where family_id is null and title = '계란말이와 밥' and steps is null;

update recipes set steps = '참치캔의 기름을 꼭 짜서 빼요.
마요네즈와 다진 양파를 넣고 버무려요.
밥 위에 올리고 김가루를 뿌려요.'
where family_id is null and title = '참치마요 덮밥' and steps is null;

update recipes set steps = '냄비에 콩나물과 물 3컵을 넣어요.
뚜껑을 덮은 채로 7분 끓여요(중간에 열면 비린내가 나요).
대파와 새우젓으로 간을 맞춰요.
밥을 말고 달걀을 풀어 넣어요.'
where family_id is null and title = '콩나물국밥' and steps is null;

update recipes set steps = '고추장 2큰술, 간장 1큰술, 설탕 1큰술을 섞어 양념을 만들어요.
앞다리살에 양념을 발라 20분 재워요.
센 불에 고기를 먼저 볶아요.
양파와 대파를 넣고 숨이 죽을 때까지 볶아요.'
where family_id is null and title = '제육볶음' and steps is null;

update recipes set steps = '감자, 당근, 양파를 깍둑썰기 해요.
냄비에 기름을 두르고 채소를 볶아요.
물 3컵을 붓고 감자가 익을 때까지 끓여요.
불을 줄이고 카레가루를 풀어 3분 더 끓여요.'
where family_id is null and title = '카레라이스' and steps is null;

update recipes set steps = '멸치육수를 끓여 국간장으로 간해요.
소면을 3분 삶아 찬물에 헹궈요.
애호박은 채 썰어 살짝 볶아요.
그릇에 면을 담고 육수를 부은 뒤 고명을 올려요.'
where family_id is null and title = '잔치국수' and steps is null;

update recipes set steps = '두부를 도톰하게 썰어 물기를 닦아요.
팬에 노릇하게 앞뒤로 구워요.
간장 2큰술, 고춧가루 1큰술, 물 3큰술을 섞어 부어요.
약한 불에서 조리다 대파를 올려요.'
where family_id is null and title = '두부조림' and steps is null;

update recipes set steps = '양파를 다져 밥과 함께 볶고 케첩으로 간해요.
볶은 밥을 접시에 담아 모양을 잡아요.
달걀 2개를 풀어 얇은 지단을 부쳐요.
지단으로 밥을 덮고 케첩을 뿌려요.'
where family_id is null and title = '오므라이스' and steps is null;

update recipes set steps = '고등어의 물기를 키친타월로 닦아요.
달군 팬에 껍질 쪽부터 구워요.
된장국은 아욱과 두부를 넣고 끓여요.
생선이 노릇해지면 뒤집어 3분 더 구워요.'
where family_id is null and title = '된장국과 생선구이' and steps is null;

update recipes set steps = '남은 나물을 종류별로 그릇에 담아요.
가운데에 달걀프라이를 올려요.
고추장 1큰술과 참기름을 넣어요.
먹기 직전에 골고루 비벼요.'
where family_id is null and title = '비빔밥' and steps is null;

update recipes set steps = '떡국떡을 찬물에 10분 담가둬요.
육수를 끓여 국간장으로 간해요.
떡을 넣고 떠오를 때까지 끓여요.
달걀을 풀어 넣고 김을 올려요.'
where family_id is null and title = '떡국' and steps is null;
