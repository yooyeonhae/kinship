-- migration_04 — favorite_links를 PRD 3.7에 맞추고 쓰기를 부모로 좁힌다
--
-- 두 가지를 고친다.
--
-- 1) 스키마가 PRD와 어긋나 있었다. PRD 3.7은 영상과 쇼핑몰(마켓컬리·쿠팡) 링크를
--    link_type(video/shopping)으로 구분하는데, schema.sql에는 link_type이 없고
--    platform CHECK가 ('유튜브','쇼츠','인스타')뿐이라 쇼핑몰 링크는 INSERT 자체가
--    막혀 있었다.
--
-- 2) 정책이 아직 policies.sql 시절 그대로라 favorite_links만 FOR ALL로 가족 전체에게
--    열려 있었다. migration_02에서 members/todos/weekly_outfit_rules를 "조회는 가족,
--    쓰기는 부모"로 옮겼으므로 여기도 같은 모양으로 맞춘다. 그러지 않으면 자녀가
--    부모가 저장해둔 링크를 지울 수 있다.
--
-- Dashboard의 SQL Editor에서 실행할 것. anon 키로는 정책 생성이 불가능하고,
-- 이 환경에는 Supabase CLI도 psql도 설치되어 있지 않다.

-- 1) link_type 추가 --------------------------------------------------------
-- 기존 행은 전부 영상 링크였다(platform CHECK가 영상 플랫폼만 허용했으므로).
alter table favorite_links
  add column if not exists link_type text not null default 'video';

alter table favorite_links
  drop constraint if exists favorite_links_link_type_check;

alter table favorite_links
  add constraint favorite_links_link_type_check
  check (link_type in ('video', 'shopping'));

-- 2) platform CHECK 확장 ---------------------------------------------------
-- 쇼핑몰을 열거로 못박으면 새 쇼핑몰이 생길 때마다 마이그레이션을 해야 한다.
-- 대신 link_type과의 정합성만 강제하고, 쇼핑몰 이름 자체는 자유 문자열로 둔다.
alter table favorite_links
  drop constraint if exists favorite_links_platform_check;

alter table favorite_links
  add constraint favorite_links_platform_check
  check (
    length(btrim(platform)) between 1 and 40
    and (link_type <> 'video' or platform in ('유튜브', '쇼츠', '인스타'))
  );

-- url이 비어 있으면 카드가 아무 데도 가지 않는다
alter table favorite_links
  drop constraint if exists favorite_links_url_check;

alter table favorite_links
  add constraint favorite_links_url_check
  check (url ~* '^https?://');

-- 제목은 oEmbed/OG에서 자동으로 채우되, 실패하면 비워둘 수 있어야 한다
alter table favorite_links
  add column if not exists title text;

alter table favorite_links
  add column if not exists thumbnail_url text;

-- 3) 정책: 조회는 가족 전체, 쓰기는 부모만 --------------------------------
drop policy if exists "favorite_links_own_family" on favorite_links;
drop policy if exists "favorite_links_select_family" on favorite_links;
drop policy if exists "favorite_links_parent_write" on favorite_links;

create policy "favorite_links_select_family" on favorite_links
  for select
  using (family_id = current_family_id());

create policy "favorite_links_parent_write" on favorite_links
  for all
  using (family_id = current_family_id() and is_parent())
  with check (family_id = current_family_id() and is_parent());
