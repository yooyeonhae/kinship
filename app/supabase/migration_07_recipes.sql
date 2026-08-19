-- migration_07 — 오늘의 추천 메뉴를 recipes 테이블로 옮기고, 가족이 직접 관리하게 한다
--
-- 지금까지 레시피 카드 2개는 ParentRecipeScreen.jsx에 JSX로 박혀 있었다(된장찌개 정식 /
-- 소불고기 덮밥). "오늘의 추천 메뉴"라고 쓰여 있지만 내일도 모레도 같은 화면이었고,
-- recipes 테이블은 만들어져 있을 뿐 행이 하나도 없었다.
--
-- 두 가지가 필요하다.
--
-- 1) family_id — PRD는 recipes를 "가족 구분 없는 공용 테이블"로 정의했지만, 그 상태로
--    쓰기를 열면 한 가족이 다른 가족의 레시피를 지울 수 있다(이 앱의 다른 테이블은
--    전부 family_id로 격리되는데 여기만 구멍이 난다). 그래서 컬럼을 nullable로 넣어
--    **null = 모두가 보는 기본 레시피(수정 불가), 값이 있으면 그 가족이 추가한 것**
--    으로 나눈다. 공용 테이블이라는 성격은 null 쪽이 그대로 유지한다.
--
-- 2) cook_minutes — 화면 카드가 "15분"을 이미 보여주고 있는데 근거가 없었다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table recipes
  add column if not exists family_id uuid references families (family_id) on delete cascade;

alter table recipes
  add column if not exists cook_minutes integer;

alter table recipes
  drop constraint if exists recipes_cook_minutes_check;

alter table recipes
  add constraint recipes_cook_minutes_check
  check (cook_minutes is null or cook_minutes between 1 and 600);

alter table recipes
  drop constraint if exists recipes_title_check;

alter table recipes
  add constraint recipes_title_check
  check (length(btrim(title)) between 1 and 60);

create index if not exists recipes_family_idx on recipes (family_id);

-- 정책 -----------------------------------------------------------------------
-- 조회: 공용(null) + 우리 가족 것
-- 쓰기: 우리 가족 것만, 그리고 부모만. 공용 레시피는 앱에서 건드릴 수 없다
--       (family_id가 null이면 두 조건 모두 false가 되어 UPDATE/DELETE가 0행이 된다).
drop policy if exists "recipes_select_all" on recipes;
drop policy if exists "recipes_select_shared_or_own" on recipes;
drop policy if exists "recipes_parent_write" on recipes;

create policy "recipes_select_shared_or_own" on recipes
  for select
  using (family_id is null or family_id = current_family_id());

create policy "recipes_parent_write" on recipes
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());

-- 기본 레시피 ---------------------------------------------------------------
-- 날짜로 회전시키려면 후보가 충분히 있어야 한다. 행이 2개뿐이면 매일 같은 화면이 된다.
-- description은 화면에서 "재료 · 재료 / 설명" 형태로 나눠 그리므로 그 규칙에 맞춘다.
insert into recipes (title, description, cook_minutes, family_id)
select * from (values
  ('된장찌개 정식', '두부, 애호박, 감자, 대파 / 된장을 풀고 재료를 넣어 끓이기만 하면 돼요.', 15, null::uuid),
  ('소불고기 덮밥', '소불고기감, 양파, 당근, 간장 / 양파와 당근을 잘게 썰어 고기와 함께 볶아 밥에 올려요.', 20, null::uuid),
  ('김치볶음밥', '묵은지, 찬밥, 달걀, 참기름 / 김치를 먼저 볶아 신맛을 날린 뒤 밥을 넣어요.', 15, null::uuid),
  ('계란말이와 밥', '달걀, 당근, 쪽파, 소금 / 약한 불에서 천천히 말아야 모양이 예쁘게 나와요.', 15, null::uuid),
  ('참치마요 덮밥', '참치캔, 마요네즈, 양파, 김가루 / 기름을 뺀 참치를 마요네즈에 버무려 밥 위에 올려요.', 10, null::uuid),
  ('콩나물국밥', '콩나물, 대파, 달걀, 새우젓 / 콩나물을 뚜껑 덮고 끓여 비린내를 잡아요.', 20, null::uuid),
  ('제육볶음', '앞다리살, 고추장, 양파, 대파 / 고기를 양념에 20분 재워두면 훨씬 부드러워요.', 25, null::uuid),
  ('카레라이스', '감자, 당근, 양파, 카레가루 / 감자가 익은 뒤에 카레가루를 풀어야 눌어붙지 않아요.', 25, null::uuid),
  ('잔치국수', '소면, 애호박, 달걀, 멸치육수 / 소면은 찬물에 헹궈야 쫄깃해요.', 20, null::uuid),
  ('두부조림', '두부, 간장, 고춧가루, 대파 / 두부를 먼저 노릇하게 구우면 부서지지 않아요.', 20, null::uuid),
  ('오므라이스', '밥, 달걀, 양파, 케첩 / 볶은 밥을 달걀지단으로 덮어 완성해요.', 20, null::uuid),
  ('된장국과 생선구이', '고등어, 두부, 아욱, 된장 / 생선은 굽기 전 물기를 닦아야 껍질이 붙지 않아요.', 25, null::uuid),
  ('비빔밥', '나물, 달걀, 고추장, 참기름 / 남은 나물을 모아 한 그릇으로 정리하기 좋아요.', 15, null::uuid),
  ('떡국', '떡국떡, 달걀, 김, 국간장 / 떡은 미리 물에 담가두면 빨리 익어요.', 20, null::uuid)
) as seed(title, description, cook_minutes, family_id)
-- 여러 번 실행해도 같은 제목이 쌓이지 않게 한다
where not exists (
  select 1 from recipes r where r.family_id is null and r.title = seed.title
);
