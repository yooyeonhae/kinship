-- 추가 정책: families DELETE (구성원이 없는 가족만)
-- Supabase Dashboard → SQL Editor에서 실행해야 적용된다 (policies.sql 이후에 추가된 내용).
--
-- 목적
--   createFamily()가 members insert 단계에서 실패했을 때, 이미 커밋된 families 행을
--   되돌릴 수 있게 한다. 되돌리지 못하면 재시도마다 고아 가족 행이 하나씩 쌓인다.
--
-- 왜 `not exists (members)` 조건을 붙였는가
--   단순히 `using (family_id = current_family_id())`로 열면, family_id(UUID)를 아는
--   누구나 가족 전체를 삭제할 수 있게 된다. schema.sql의 FK가 on delete cascade이므로
--   members / todos / weekly_outfit_rules / favorite_links가 전부 함께 사라진다.
--   즉 앱에서 가장 파괴적인 권한이 되는데, 정작 앱이 필요한 삭제는
--   "구성원을 넣기 전에 실패한 빈 가족을 되돌리는 것" 하나뿐이다.
--   그래서 그 경우만 허용하고, 구성원이 한 명이라도 있는 가족은 API로 삭제할 수 없게 둔다.
--
--   나중에 "가족 삭제" 기능을 정식으로 만들 때는 부모 역할 확인이 들어간 별도 정책이
--   필요하다(권한 모델 논의 참고). 이 정책을 넓히는 방식으로 하지 말 것.

create policy "families_delete_own_empty" on families
  for delete
  using (
    family_id = current_family_id()
    and not exists (
      select 1 from members m where m.family_id = families.family_id
    )
  );
