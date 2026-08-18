-- family_id 기반 RLS 정책
-- 로그인 없이, 클라이언트가 매 요청에 x-family-id 헤더로 자기 가족의 UUID를 실어 보내는 방식.
-- 보안 수준: family_id(UUID)를 아는 사람만 그 가족 데이터에 접근 가능 (진짜 사용자 인증은 아님).

create or replace function current_family_id() returns uuid as $$
  select nullif(current_setting('request.headers', true)::json->>'x-family-id', '')::uuid
$$ language sql stable;

-- families: 새 가족 생성(insert)은 누구나 가능해야 초대코드처럼 처음 만들 수 있음.
-- 이후 조회/수정은 자기 family_id를 아는 경우만.
create policy "families_insert_any" on families
  for insert
  with check (true);

create policy "families_select_own" on families
  for select
  using (family_id = current_family_id());

create policy "families_update_own" on families
  for update
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

-- members: 자기 가족 소속 행만 CRUD
create policy "members_own_family" on members
  for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

-- weekly_outfit_rules: members를 거쳐 family_id 확인
create policy "weekly_outfit_rules_own_family" on weekly_outfit_rules
  for all
  using (exists (
    select 1 from members m
    where m.member_id = weekly_outfit_rules.member_id
      and m.family_id = current_family_id()
  ))
  with check (exists (
    select 1 from members m
    where m.member_id = weekly_outfit_rules.member_id
      and m.family_id = current_family_id()
  ));

-- todos: 자기 가족 소속 행만 CRUD
create policy "todos_own_family" on todos
  for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

-- favorite_links: 자기 가족 소속 행만 CRUD
create policy "favorite_links_own_family" on favorite_links
  for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

-- recipes: 가족 구분 없는 공용 테이블 → 누구나 조회만 가능 (등록/수정은 클라이언트에서 하지 않는다고 가정)
create policy "recipes_select_all" on recipes
  for select
  using (true);
