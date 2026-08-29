# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## PRD 요약 (기준 문서)

`prd.md`(7단계 워크시트 기반)와 8단계 기술스택 워크시트에서 확정된 내용의 요약. 이 프로젝트에서 작업할 때 항상 이 섹션을 기준으로 삼는다. 전체 근거·맥락은 `prd.md`와 `docx/7단계_워크시트*.pdf`/`docx/8단계_워크시트*.pdf` 참고.

**프로젝트 개요**: "우리가족 올인원"은 맞벌이 부모의 아침 의사결정 피로(옷차림·할일 확인 누락)와 부부간 정보 확인 누락을 해결하는 가족소통 허브. 자녀는 앱을 열면 날씨·요일별 지정복 기반 옷차림을 확인하고, 부모는 오늘의 간단 레시피를 거쳐 가족 할일로 이어지는 구조.

**타겟 사용자**: 육아중인 맞벌이 가족(부모+자녀 모두 포함)으로 확정. 실제 인터뷰 표본은 40대 주부 1인뿐이라는 한계를 인지한 채 진행.

**핵심 기능 (Must)**:
1. 자녀 선택 후 요일별 지정복 자동 표시 — 체육복 요일 깜박함 해결
2. 날씨 연동 옷차림 추천 — 날씨·학교일정 확인을 하나로 통합
3. 가족 할일 원탭 등록/자동 노출 — "적는 행위 자체의 번거로움" 해결

(부부 완료 동기화, 레시피, 아이용 할일체크는 Should 등급 — 화면에는 포함되지만 Must는 아님)

**데이터 구조**: 6개 테이블 — `families`(family_id, name) / `members`(family_id FK, name, role) / `weekly_outfit_rules`(member_id FK, day_of_week, outfit_type) / `todos`(family_id FK, title, assignee_member_id FK, is_done, completed_by FK, completed_at) / `recipes`(title, description — 가족 구분 없는 공용 테이블) / `favorite_links`(family_id FK, platform, url). 관계: families 1:N members, members 1:N weekly_outfit_rules, families 1:N todos, members 1:N todos(assignee/completed_by 두 역할), families 1:N favorite_links. 날씨는 외부 API 실시간 호출로 별도 저장하지 않음(의도적). 실제 DDL/RLS는 `app/supabase/schema.sql`·`app/supabase/policies.sql`에 구현되어 있고, Seoul 리전의 `kinship` 전용 Supabase 프로젝트에 적용됨(RLS는 family_id 기반 격리, 로그인 없이 `x-family-id` 헤더로 구분). 그 위에 마이그레이션 3개가 모두 적용되어 있다:

- `migration_01_families_delete.sql` — `families_delete_own_empty`. **구성원이 하나도 없는 가족만** 삭제 허용. 온보딩이 members 단계에서 실패했을 때 이미 커밋된 빈 families 행을 되돌리는 용도다. 조건 없이 열면 FK의 `on delete cascade` 때문에 앱에서 가장 파괴적인 권한이 되므로, 정식 "가족 삭제" 기능이 필요해지면 이 정책을 넓히지 말고 부모 확인이 들어간 별도 정책을 만들 것. 양방향 REST 검증 완료(빈 가족 → 삭제됨 / 구성원 있는 가족 → 보호됨, **둘 다 `204`를 반환**한다).
- `migration_02_roles_and_parent_pin.sql` — 역할 기반 정책 + 부모 PIN + RPC(`create_family`, `set_parent_pin`, `parent_login`, `parent_logout`, `toggle_my_todo`). 아래 "부모 권한" 항목 참고.
- `migration_03_fix_pin_bruteforce.sql` — `set_parent_pin`을 통한 PIN 무제한 추측 차단.
- `migration_04_favorite_links.sql` — `favorite_links`를 PRD 3.7에 맞춤. `link_type`(`video`/`shopping`)·`title`·`thumbnail_url` 추가, `platform` CHECK를 넓혀 쇼핑몰 허용(영상일 때만 유튜브/쇼츠/인스타로 제한), 정책을 "조회는 가족·쓰기는 부모"로 교체. **아직 적용 전이면 저장이 실패한다** — `FavoriteLinks.jsx`가 그 에러를 알아보고 안내 문구로 바꿔준다.
- `migration_05_family_room.sql` — 아지트를 실데이터로. `chat_messages`(가족 채팅)와 `game_results`(미니게임 승패 = **가족 포인트의 유일한 근거**). 채팅·게임 결과는 **자녀도 INSERT할 수 있어야** 하므로 쓰기를 부모로 좁히지 않고, 삭제만 부모 전용이다. 포인트 값은 클라이언트가 정하면 얼마든지 부풀릴 수 있어 **CHECK로 못박았다**(승리 10p / 무승부 5p). `familyRoom.js`의 `pointsFor()`가 이 값과 어긋나면 INSERT가 제약에 걸려 통째로 실패한다.
- `migration_06_updown_game.sql` — 미니게임 '숫자 맞히기(업다운)' 추가에 따른 `game_results.game_key` CHECK 확장. **게임을 추가할 때마다 이 CHECK를 넓혀야** 그 판의 결과가 저장된다(열거를 없애지 않은 이유는 파일 주석 참고 — 오타가 나면 전적이 조용히 사라진다).
- `migration_07_recipes.sql` — 오늘의 추천 메뉴를 `recipes` 테이블로. `family_id`(nullable)와 `cook_minutes` 추가 + 기본 레시피 14개 시드. **PRD는 `recipes`를 "가족 구분 없는 공용 테이블"로 정의했지만 그대로 쓰기를 열면 한 가족이 다른 가족 것을 지울 수 있어**, `family_id is null` = 모두가 보는 기본 레시피(앱에서 수정 불가), 값이 있으면 그 가족 것으로 나눴다. 쓰기는 부모만. 시드는 제목 중복 검사를 하므로 여러 번 실행해도 쌓이지 않는다.
- `migration_08_rewards.sql` — 가족 포인트 보상 목표(`rewards`). 조회는 가족 전체(아이도 목표를 봐야 동기가 된다), 등록·수정·**달성 처리는 부모만** — 아이가 스스로 소진 처리하면 협의가 아니라 선언이 된다.
- `migration_09_schedules.sql` — 아이 요일별 스케줄(`schedules`). `repeat_type`이 `weekly`면 `day_of_week`만, `once`면 `schedule_date`만 차야 한다(`schedules_when_check`) — 둘 다 비면 언제인지 알 수 없고 둘 다 차면 어느 쪽을 따를지 알 수 없다. `alarm_minutes`는 "몇 분 전"이고 null이면 알림 없음. 쓰기는 부모만(todos·weekly_outfit_rules와 같은 규칙). **여러 요일 반복은 고른 요일마다 한 행씩 넣는다** — `day_of_week`를 배열이나 비트마스크로 바꾸지 않은 이유는 요일별로 묶어 보여주는 화면·`isToday()`·알림 예약이 모두 "한 행 = 한 요일"을 전제로 이미 맞아떨어지고, CHECK도 그대로 쓸 수 있어서다. 대신 지우기는 요일별이고, 같은 아이·이름·시간이 그 요일에 이미 있으면 넣지 않는다(겹치면 알림이 두 번 뜬다).
- `migration_10_family_name_unique.sql` — `families.name` 중복 금지. **`lower(btrim(name))` 기준**이라 대소문자·앞뒤 공백만 다른 이름도 같은 이름으로 본다(그러지 않으면 막는 의미가 없다). `create_family`를 다시 정의해 `unique_violation`을 잡아 `{ok:false, error:'name_taken'}`으로 돌려주고, `OnboardingScreen`이 이를 "이미 같은 이름의 가족이 있어요"로 보여준다. 중복 여부를 미리 select로 확인하지 않는 이유는 확인과 insert 사이에 다른 요청이 끼어들 수 있어서다. **이미 중복이 있으면 인덱스 생성이 실패하므로 파일 상단의 확인 질의를 먼저 돌릴 것** — 가족 데이터라 자동 정리는 넣지 않았다.
- `migration_11_member_avatar.sql` — 구성원 캐릭터(`members.avatar`, 이모지 한 글자). 이미지 파일이 아닌 이유는 Storage 버킷·업로드 권한이 "네댓 명 구분"에 비해 과해서다. **`create_family`를 다시 정의**해 생성 시점에 avatar를 함께 넣는다 — `members` 쓰기는 부모 전용인데 가족을 막 만든 시점엔 부모 토큰이 없어 나중에 UPDATE할 수 없다. 후보는 12지신 동물이고 부모·자녀가 같은 목록을 쓴다(`app/src/lib/avatars.js`).
- `migration_12_recipe_steps.sql` — 레시피 본문(`recipes.steps`). 단계를 배열이나 별도 테이블로 쪼개지 않은 이유는 개별 조회·순서 변경이 없고 부모가 한 번에 적어 넣기 때문이다. **줄바꿈이 곧 단계**이고 번호는 화면에서 붙인다(`parseSteps`가 사용자가 직접 적은 번호를 지운다 — 안 그러면 "1. 1. …"이 된다). 기본 레시피 14개의 조리법도 함께 채운다.
- `migration_13_quick_tasks.sql` — "자주 쓰는 항목"(`quick_tasks`). localStorage가 아닌 이유는 부모 두 사람이 서로 다른 기기를 쓰기 때문이다. 쓰기는 부모만 — `todos` 등록이 부모 전용인데 그 지름길만 열면 규칙이 샌다. 기존 가족에는 예전 하드코딩 3개를 시드로 넣어, 마이그레이션 직후 칩이 사라진 것처럼 보이지 않게 한다.
- `migration_14_push_subscriptions.sql` — 웹 푸시 구독(`push_subscriptions`). 브라우저가 발급한 `endpoint`/`p256dh`/`auth`를 기기마다 저장한다. `endpoint`가 unique라 같은 기기가 다시 켜도 행이 쌓이지 않는다(쌓이면 알림이 여러 번 온다). **쓰기를 부모로 좁히지 않는다** — 자녀도 자기 기기에 알림을 켜야 하고, 이건 가족 데이터를 바꾸는 일이 아니라 내 기기를 등록하는 일이다.
- `migration_15_chat_retention.sql` — 가족톡 7일 보관. **`pg_cron` 확장을 Dashboard에서 먼저 켜야** 한다(꺼져 있으면 `cron.schedule`에서 멈춘다). 삭제 함수가 `security definer`인 이유는 cron 작업에 요청 헤더가 없어 `current_family_id()`가 null이 되고, RLS를 그대로 통과시키면 한 행도 못 지우기 때문이다. 대신 함수 실행 권한을 `revoke`해 클라이언트가 부르지 못하게 막았다.
- `migration_16_game_sessions.sql` — 원격 턴제 대전(`game_sessions`). 판은 `state jsonb` 한 칸에 통째로 오간다 — 규칙은 화면이 갖고 서버는 "지금 판이 이렇다"만 나른다. **차례는 서버가 강제하지 못한다**: RLS는 행 단위라 "지금 turn인 사람만 state를 바꾼다"를 표현할 수 없고 `x-member-id`도 자기신고값이다. 이 기능이 보장하는 건 "떨어져서 같이 둔다"까지이고 차례 지키기는 화면 수준의 약속이다.
- `migration_17_wordchain.sql` — 미니게임 '합이 15'를 '끝말잇기'로 교체. `game_key` CHECK가 **두 곳**(`game_results`·`game_sessions`)에 있어서 둘 다 넓혀야 한다 — 한쪽만 고치면 "혼자서는 되는데 원격만 안 된다"로 보인다. `'sum15'`를 열거에서 빼지 않는 이유는 이미 저장된 전적이 그 값을 갖고 있어서다(빼면 CHECK 추가 자체가 실패한다). 아직 적용 전이면 `isUnknownGameKey()`가 23514를 알아보고 안내 문구로 바꿔준다.
- `migration_18_todo_due_and_stars.sql` — 할일의 "오늘" 기준(`todos.due_date`), 아이가 스스로 넣는 할일(`todos.self_made` + `add_my_todo`/`delete_my_todo` RPC), 아이별 보상 목표(`rewards.member_id`). 아래 "별과 포인트" 항목 참고. `due_date`는 **nullable로 넣고 `created_at::date`로 채운 뒤 not null로 조인다** — 처음부터 `not null default current_date`로 만들면 기존 행이 전부 '오늘'이 되어 방금 넣은 것과 며칠 전 것을 구분할 수 없다.
- `migration_19_todo_approval.sql` — 부모의 확인 도장(`todos.approved_by`/`approved_at` + `approve_todo` RPC). **도장이 아이 별 합산의 조건이다** — 아이가 체크만 하면 "확인 기다림"(별 0)이고, 부모가 찍으면 별 +1. 체크는 아이가 혼자 누르는 것이라 실제로 했는지는 아이만 알고, 별은 보상으로 바뀌는 값이라 확인하는 사람이 필요하다. (처음엔 '도장 = 별 2배'였는데, 승인을 합산 조건으로 두면 미승인이 0이라 배수의 기준이 사라져 도장 하나로 합쳤다.) **`toggle_my_todo`를 다시 정의해 완료를 풀면 도장도 떨어뜨린다** — 안 그러면 체크를 껐다 켜는 것만으로 부모가 보지 않은 일에 2배 별이 되살아난다. 도장은 **끝난 할일에만** 찍힌다(완료 전에 찍히면 "잘했다"가 아니라 "이건 2배짜리"라는 예고가 된다). **스트릭은 이 파일에 없다** — 며칠 연속인지는 `due_date`+`is_done`으로 계산할 수 있고, 따로 저장하면 할일을 지웠을 때 기록만 남아 어긋난다.

- `migration_21_family_settings.sql` — 가족이 정하는 설정값(`family_settings`). 코드에 박혀 있던 숫자를 꺼낸 것이다: 할일 1개당 포인트, 아이 하루 미션 상한, 별 승인 필요 여부, 밀린 할일 정리 기간, 가족톡 보관 기간. **행이 없는 가족은 기본값으로 본다** — `create_family`를 또 고치지 않아도 되고, 나중에 기본값을 바꾸면 그 가족들에게 자동 적용된다(`family_setting_int()`가 coalesce로 처리). 읽기는 가족 전체(아이도 "하루 몇 개까지"를 알아야 한다), 쓰기는 부모만. **밀린 할일 정리(`purge_old_todos`)는 완료한 할일을 절대 지우지 않는다** — 별과 포인트가 "지금 완료 상태인 할일"에서 계산되므로, 완료한 것을 지우면 아이가 모은 별이 함께 사라진다. 지우는 대상은 "기한이 지났는데 아직 안 한 할일"뿐이다. cron이 아니라 앱을 열 때 클라이언트가 부르는 이유는 설정이 가족마다 다르고, pg_cron을 쓰면 어디서 지워지는지 저장소만 봐서는 알 수 없어서다.

- `migration_22_more_settings.sql` — 설정 넷 추가(기본 지역·지난 일 표시 기간·주말 미션 상한) + **`families` 수정 권한을 부모로 조인다**. `policies.sql`의 `families_update_own`은 `family_id`만 봐서 아이도 가족 이름을 바꿀 수 있었다 — migration_02에서 todos·members를 조일 때 빠졌던 것이, 설정에 이름 바꾸기가 생기면서 드러났다. 주말 판정(`extract(isodow from app_today())`)도 **서울 기준**이어야 한다: UTC로 보면 한국의 토요일 아침이 아직 금요일이라 주말 상한이 하루 늦게 열린다(migration_20과 같은 함정).

앞으로 정책·스키마를 추가할 때는 `app/supabase/`에 `migration_NN_*.sql`로 파일을 만들고, Dashboard의 SQL Editor에서 실행해야 반영된다(anon 키로는 정책 생성이 불가능하고, 이 환경에는 Supabase CLI·psql이 설치되어 있지 않다).

**확정된 기술스택** (8단계, 경량 버전 선택 — 로그인 없는 가족 내부용 웹앱이라 SSR/Edge Functions 불필요):
- 프론트엔드: React + Vite (정적 SPA)
- 백엔드/DB: Supabase (기본 테이블 + RLS. 워크시트 단계에서는 "RLS만"이었지만, 열 단위 제한과 원자성이 RLS로 불가능한 지점에 한해 `security definer` RPC를 쓴다 — 아래 "부모 권한" 항목)
- 배포: Vercel 무료 티어 (+ `app/api/`의 서버리스 함수 몇 개. 워크시트의 "SSR/Edge Functions 불필요"에서 벗어난 유일한 지점으로, **외부 API 키를 브라우저에 노출하지 않기 위한 프록시 용도로만** 쓴다 — 렌더링은 여전히 정적 SPA다)

## Project

"우리가족 올인원" (family daily-planner PWA) — a school project (바이브코딩 기반 디지털플랫폼 제작). Target persona: a dual-income parent juggling kids' morning routine (weather/outfit, school prep), shared household todos, dinner recipes, and family communication while away from home.

**`prd.md` is the source of truth for scope and data model.** It also encodes development rules that apply to this repo specifically:
- Don't add features not listed in the PRD without asking first.
- Undecided items (e.g. which weather API, which turn-based games) must be confirmed with the user before building — never picked arbitrarily.
- Implement Must → Should → Could in that order.
- `kinship/*.png` are the binding visual reference for each screen's layout — not just inspiration; `design-system/MASTER.md` is the derived, currently-active design system (colors, type scale, "콜라주/스크랩북" decoration language, motion rules). `kinship_collage/DESIGN.md` is an earlier superseded draft — don't treat it as current.
- `docx/*단계_워크시트*.pdf` are the underlying school-assignment worksheets (persona research, benchmarking, journey map) that `prd.md` was distilled from — background only, not something code needs to read.

## Current implementation stage

`screens/` is still **static HTML + vanilla JS + Tailwind CDN, with no build step, no bundler**, and runs client-side against `localStorage` — treat that as intentional for those files, not a shortcut to "fix".

The PRD's target stack (React/Vite/Supabase) has since been adopted in `app/`, with explicit user confirmation at each step. **`app/` is now a working React SPA, not just a scaffold:** a single `app/index.html` entry + `react-router-dom`, with all 9 screens ported from `screens/*.html` into `app/src/pages/*.jsx` and the shared chrome (`Layout` / `Header` / `BottomNav`) in `app/src/components/`. `app/.env` (gitignored) holds `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for the dedicated `kinship` Supabase project, plus the server-only `TOUR_API_KEY`, `TOUR_API_SERVICE`, `WEATHER_API_KEY` (외부 API 항목 참고).

**Supabase is wired for the 가족 할일 domain only.** `families` / `members` / `todos` are live (entry, child-outfit name lookup, child-todo, parent-tasks, parent-progress). Everything else is still hardcoded dummy data on purpose: 정보 피드. 아지트(채팅·접속 표시·가족 포인트)는 migration_05로 실데이터에 붙었고, 퇴근길 저장함은 migration_04로 `favorite_links`에 붙었다. 냉장고 재료는 화면째 삭제됨(스키마에 테이블이 없는 더미였다). Don't assume a screen is connected just because it renders real-looking data. 요일별 지정복(`weekly_outfit_rules`)은 Supabase에 붙어 있고, 주말 나들이(`WeekendScreen`)와 옷차림 날씨(`ChildOutfitScreen`)는 **Supabase가 아니라 외부 API**를 쓴다 — 아래 "외부 API" 항목 참고.

**No login — `family_id` is the whole auth model.** `app/src/context/FamilyContext.jsx` owns it: stored in `localStorage` under `kinship_family_id`, sent as the `x-family-id` header by the client factory in `app/src/lib/supabaseClient.js`. `OnboardingScreen` creates the family; `App.jsx` gates every other route behind it and redirects to `/onboarding` when absent. `FamilyContext` also verifies the stored id still resolves to a real `families` row and self-clears if it doesn't (a stale id otherwise leaves the user stuck in an empty shell, because RLS returns `[]` rather than an error for a family that doesn't exist).

**부모 권한은 서버에서 강제된다 (migration_02·03 적용 완료).** 요청에 3개가 실린다 — `x-family-id`(가족 범위), `x-member-id`(지금 누구로 쓰는지, **자기신고값**), `x-parent-token`(`parent_login()`이 발급한 토큰, 부모 권한의 유일한 근거). 강제 규칙: `todos` 조회는 가족 전체, **생성·삭제·수정은 부모만**, 자녀의 완료 체크는 `toggle_my_todo()` RPC로 **자기 담당만**. `members`·`weekly_outfit_rules` 쓰기도 부모만.

- 자녀에게 `todos` UPDATE를 주지 않는 이유: **RLS는 행 단위라 열 단위 제한이 불가능**하다. 직접 UPDATE를 허용하면 `is_done`만 바꾸도록 제한할 방법이 없어 제목·담당자까지 바꿀 수 있다. 그래서 `toggle_my_todo()` 하나만 열어두고, `completed_by`도 **서버가** `acting_member_id()`로 정한다(클라이언트가 보내는 값이 아니다).
- **PIN을 설정하지 않은 부모는 `x-member-id` 자기신고로 부모가 된다.** 마이그레이션이 기존 가족을 깨뜨리지 않게 한 의도적 설계이고, PIN을 설정하는 순간 그 부모에 대해서만 이 경로가 닫힌다(가족 단위 플래그 없음). 앱 UI는 부모 진입 시 항상 PIN을 만들게 하므로 실사용에서는 곧 닫힌다.
- PIN은 bcrypt 해시로 `parent_pins`에 저장한다. 이 테이블과 `parent_sessions`는 **정책을 일부러 만들지 않고 `revoke all`까지** 걸어서 REST로 접근할 수 없다(`permission denied`). `security definer` 함수만 다룬다. `members`에 넣지 않은 이유는 RLS가 열 단위 제한을 못 해서 클라이언트가 `select=pin_hash`로 읽어갈 수 있기 때문이다.
- PIN 실패는 `raise`가 아니라 **반환값**으로 알린다. `raise`하면 트랜잭션이 롤백되어 `failed_attempts` 증가까지 사라지고 잠금이 영원히 걸리지 않는다. `parent_login`과 `set_parent_pin`이 **같은 카운터를 공유**한다(migration_03) — 공유하지 않으면 `set_parent_pin`의 `old_pin` 검증으로 4자리 PIN을 무제한 전수 탐색할 수 있었다. 5회 실패 → 15분 잠금.
- 클라이언트: `FamilyContext`가 `currentMemberId`(localStorage `kinship_member_id`)와 `parentAuth`(`kinship_parent_auth`)를 들고 있다. **토큰은 그 토큰의 주인으로 앱을 쓰고 있을 때만 전송한다** — 부모가 로그인한 뒤 자녀로 전환했는데 토큰이 계속 실려 나가면 그 자녀가 부모 권한을 그대로 쓰게 된다. `isParentRole`(역할만)과 `isParentAuthed`(토큰 있음)를 구분해서 쓸 것.
- `App.jsx`의 `RequireParent`는 `isParentAuthed`를 요구하고, 토큰이 없으면 `/parent-unlock/:memberId`로 보낸다. 토큰 없이 화면에 들어가게 하면 화면은 열리는데 모든 쓰기가 42501로 실패한다.

**남는 한계 (발표에서 과장하지 말 것)**: `x-member-id`는 자기신고값이라 자녀 A가 자녀 B의 member_id를 넣으면 B의 할일을 체크할 수 있다(형제간 장난은 막지 못한다). 가족의 **첫** PIN은 `family_id`를 아는 사람이 선점할 수 있다 — `family_id`가 유일한 공유 비밀인 이 계층의 구조적 한계다. 즉 이 시스템이 주장할 수 있는 최대치는 **"PIN을 아는 사람 = 부모"**이며, 진짜 사용자 인증(Supabase Auth)은 아니다.

**Non-obvious RLS constraint — don't "simplify" `createFamily()`.** Inserting into `families` must (a) supply a client-generated `family_id` (`crypto.randomUUID()`), (b) use a client whose `x-family-id` header already equals that id, and (c) **not** chain `.select()`. Reason: `.select()` makes PostgREST send `Prefer: return=representation`, and Postgres applies the SELECT policy to the `INSERT ... RETURNING` row. `families_select_own` requires `family_id = current_family_id()`, so a DB-generated id can never match the header and the entire INSERT is rolled back with `42501`. This was verified empirically (`return=minimal` → 201, `return=representation` → 42501). `todos` and `members` are immune because their policies are `FOR ALL`, which covers the returning-select too.

**Realtime은 Broadcast/Presence만 쓴다 — `postgres_changes`는 이 앱에서 동작하지 않는다.** 신원이 PostgREST 요청 헤더(`x-family-id`)에만 실리는데, `postgres_changes`는 웹소켓 연결의 JWT로 RLS를 평가하므로 그 헤더가 존재하지 않는다. `current_family_id()`가 null이 되어 **에러 없이 아무 행도 전달되지 않는다**(조용히 안 되는 쪽이라 디버깅이 오래 걸린다). 그래서 `app/src/lib/familyRoom.js`는 "테이블 INSERT는 PostgREST로, 알림은 같은 내용을 Broadcast로" 조합한다 — PRD 3.8이 지정한 Broadcast/Presence와도 일치한다. 채널 이름(`family-room:<family_id>`)에 family_id가 들어가므로 family_id를 아는 사람은 채널에 들어올 수 있다(앱 전체와 같은 구조적 한계).

**아지트의 미니게임은 끝말잇기 / 계산 빙고 / 계단 오르기 / 숫자 맞히기 네 개다.** 한 기기에서 번갈아 하는 핫시트와 `game_sessions`를 통한 원격 대전 두 방식을 모두 쓴다(`session`이 null이면 핫시트). 게임을 고칠 때 지켜야 하는 것들:

- **모든 게임은 판마다 선(先)을 바꾼다 — 진 사람이 다음 판의 선.** 번갈아 하는 게임은 예외 없이 선이 유리해서(시뮬레이션에서 빙고 65%, 끝말잇기·계단도 같은 방향) 한 판 안에서는 없앨 수 없다. p2에게 공짜 칸을 주는 식의 보정은 33:67로 뒤집혀서 쓰지 않았다.
- **"플레이어가 고를 것이 있는가"가 판단 기준이다.** 계단 오르기의 한 턴 상한(모아둔 칸이 0 아니면 10으로만 끝났다), 빙고의 문제 한 개(정답 칸이 하나뿐이라 뚫리는 순서가 완전 무작위였다), 예전 숫자 맞히기의 공용 정답(범위의 가운데를 부르는 것 말고 할 게 없고 승자가 차례 순서로 정해져 있었다)이 모두 같은 병이었다. 규칙을 바꿀 때는 Node로 승률·판 길이를 돌려보고 고칠 것.
- **끝말잇기는 사전 검사를 하지 않는다.** 앱은 끝 글자(두음법칙 포함)·글자 수·중복만 본다. 국어사전 API는 키가 따로 필요하고, 아이들이 쓰는 말은 사전에 없어서 "맞는 말인데 안 된다"가 더 자주 생긴다. 실제 낱말인지는 가족이 판단하고, **이 경계는 화면에 적어뒀다**. 막혔을 때는 시간 제한이 아니라 "모르겠어요" 버튼으로 넘긴다 — 시간 제한은 PRD가 일부러 뺀 반응속도 게임 쪽이다.
- 게임을 추가하면 `game_key` CHECK를 **두 곳** 넓혀야 한다(migration_17 항목 참고).

`screens/family-room.html`(정적 버전)은 예전 합이 15를 그대로 갖고 있다 — 두 버전은 의도적으로 따로 간다.

**별과 포인트는 다른 저금통이다 (migration_18).** 아이의 **별** = 그 아이 담당으로 지금 완료 상태인 할일 수, 가족 **포인트** = 게임 점수 + 완료한 할일 × 10p. 규칙 세 가지:

- **아이가 스스로 만든 할일(`self_made`)은 가족 포인트를 주지 않는다.** 아이가 할일을 만들 수 있는데 완료 하나가 10p면 "물 마시기" 스무 개로 200p가 된다. 별만 주면 자율성은 살고 점수 부풀리기는 막힌다. `loadTodoPoints()`의 `.eq('self_made', false)`가 그 지점이다.
- **아이가 할일을 넣는 길은 `add_my_todo()` RPC 하나뿐이다.** `todos` INSERT 정책을 열면 RLS가 행 단위라 "담당자는 반드시 자기 자신"을 강제할 수 없어 아이가 남에게 할일을 떠넘길 수 있다. 담당자·마감일·`self_made`를 서버가 정하고, 하루 10개 상한과 같은 날 같은 제목 금지도 서버에 있다(별을 모으려고 할일을 수십 개 만드는 것을 막는다). 지우는 것도 `delete_my_todo()`로 **자기가 만든 것만** — 부모가 준 할일을 지울 수 있으면 "하기 싫으면 지운다"가 된다.
- **스트릭은 '완료' 기준, 별은 '승인' 기준이다.** 부모가 며칠 뒤에 확인해도 아이의 연속 달성이 깨지지 않아야 하고(아이가 한 일은 그날 한 것이다), 별은 확인된 것만 쌓인다. 두 기준이 다른 것은 의도된 것이다.
- **연속 달성(스트릭)은 저장하지 않고 매번 계산한다**(`computeStreak`). 규칙 두 개가 핵심이다: 할일이 하나도 없던 날은 **건너뛴다**(부모가 아무것도 안 준 날에 아이가 연속을 잃으면 아이 잘못이 아닌 일로 벌을 주는 셈이다), 오늘이 아직 안 끝났으면 **끊지 않는다**(하루가 끝나기 전에 "끊김"을 보여주면 지금 하려던 아이의 의욕을 꺾는다).
- **아이 화면은 `due_date`가 오늘인 것만 보여준다.** 예전에는 날짜 칼럼이 없어서 그 아이의 할일 '전부'를 불러왔고, "오늘 할일"이라 부르면서 며칠 치가 섞여 별 막대가 끝없이 길어졌다. 지난 것은 최근 7일치 미완료만 접어서 따로 보여준다(`splitByDay`). 할일이 0개인 날은 빈 막대 대신 "스스로 정해볼까?"와 입력칸을 보여준다 — 0/0개 막대는 뭘 해야 하는지 알려주지 않는다.

**설정 성격의 것은 우측 상단 메뉴(`TopMenu`)로 모은다.** 예전에는 알림 켜기가 아지트 안에, 부모 모드 끝내기가 부모 할일 화면 맨 아래에, 초대가 홈에만 있었다 — 같은 성격의 것이 화면마다 흩어져 있으면 사용자는 그것이 있는 줄도 모른다. 부모 전용 화면(스케줄·지정복·레시피·부부 현황)은 하단 탭에 없어서 진입로가 부모 할일 화면 하나뿐이었는데, 그 길도 여기로 냈다. 새 설정을 추가할 때는 `lib/settings.js`의 `SETTING_FIELDS`에 한 줄 넣으면 화면이 따라온다 — **범위(min/max)를 SQL의 CHECK와 같게 적을 것**(어긋나면 저장 버튼을 눌러야만 알 수 있다).

**가족 포인트 = 게임 점수 + 끝낸 할일 수 × 10p(기본값, 설정에서 바꿀 수 있다).** 할일 점수는 적립 표에 쌓지 않고 **지금 완료 상태인 할일 수에서 매번 계산한다**(`loadTodoPoints`) — 완료 이벤트를 쌓으면 체크를 켰다 껐다 하는 것만으로 점수가 무한히 늘어난다. 상태에서 계산하면 체크를 풀 때 점수도 함께 돌아간다. 할일을 토글하면 `kinship:points` 이벤트가 나가고 아지트가 다시 읽는다(`kinship:change`가 아닌 이유: 그걸 쓰면 할일 화면 자신의 목록 새로고침까지 돌아 진행 애니메이션이 다시 튄다).

**"오늘의" 메뉴는 무작위가 아니라 날짜로 정한다** (`app/src/lib/recipes.js`의 `pickTodayRecipes`). 무작위로 뽑으면 (a) 새로고침할 때마다 바뀌어 "오늘의"가 아니게 되고, (b) 같은 날 가족끼리 서로 다른 메뉴를 봐서 "오늘 카레래" 같은 대화가 어긋난다. `recipe_id`로 정렬을 고정한 뒤 날짜 숫자로 인덱스를 잡으므로, 회전의 기준이 흔들리지 않게 `sortRecipes()`를 거치지 않고 목록을 넘기면 안 된다. `description`은 `"재료, 재료 / 한 줄 설명"` 한 줄에 담고 화면에서 `parseDescription()`이 재료 칩과 설명으로 나눈다 — 손으로 입력하는 칸이라 이 형식을 안 지킨 값도 들어오며, 그때는 전체가 설명이 된다.

**원격 대전의 판 동기화는 Broadcast로 "바뀌었다"만 알리고 내용은 DB에서 다시 읽는다** (`app/src/lib/gameSession.js`). 판 자체를 브로드캐스트에 실으면 순서가 보장되지 않아 오래된 판이 새 판을 덮을 수 있다. 받은 판을 되쏘지 않도록 **판 내용의 서명(JSON)** 을 비교해 걸러낸다 — 불리언 플래그로는 안 된다. 올린 뒤 돌아온 행의 `state`는 내용이 같아도 새 객체라, 참조 비교(`local === session.state`)로는 "안 바뀌었다"를 알 수 없어 같은 판을 끝없이 다시 올렸다(원격 대전이 느리고 자주 실패했던 원인). 게임 결과 기록은 **방을 만든 쪽(p1)만** 남긴다(둘 다 남기면 포인트가 두 번 쌓인다).

**아지트 채팅은 웹 푸시로 휴대폰 알림창에 뜬다** (`app/public/sw.js`, `app/api/push.js`, `app/src/lib/push.js`). 서비스 워커가 필요한 이유는 두 가지 — 페이지에서 만드는 `new Notification()`은 **안드로이드 크롬에서 지원되지 않고**, 앱을 닫으면 코드가 돌지 않는다. 알림을 쏘는 주체는 **메시지를 보낸 쪽 클라이언트**다(`notifyFamily()` -> `POST /api/push`). Supabase Database Webhook을 쓰지 않은 이유는 보낸 사람이 정의상 접속해 있어 DB가 대신 알릴 필요가 없고, 웹훅을 쓰면 설정이 Dashboard 안에 숨어 저장소만 봐서는 알림이 어디서 나가는지 알 수 없기 때문이다. `/api/push`는 **서비스 롤 키를 쓰지 않고** anon 키 + `x-family-id`로 RLS 범위 안에서 구독을 읽는다 — 서비스 롤을 서버에 두면 이 함수가 뚫렸을 때 DB 전체가 열린다. VAPID 키는 `app/.env`에 **`VITE_` 접두사 없이** 넣고(개인키가 번들에 박히면 안 된다), 공개키는 `GET /api/push`로 내려준다. `sw.js`가 `public/`에 있는 건 서비스 워커가 자기 위치 아래 경로만 관리하기 때문이고, Vercel의 SPA rewrite는 실제 파일이 있으면 건너뛰므로 `index.html`로 덮이지 않는다.

**스케줄 알림은 앱이 열려 있는 동안에만 울린다** (`app/src/lib/schedules.js`, `TodaySchedule.jsx`). `setTimeout` + Notification API라, 앱을 닫으면 아무 일도 일어나지 않는다. 앱을 닫아둔 채 울리는 진짜 푸시는 서비스 워커 + 푸시 서버(VAPID)가 필요하고 "정적 SPA + 프록시 몇 개"라는 이 프로젝트의 기술 선택 밖이다. **이 한계를 화면에도 적어뒀다** — 울릴 거라 믿고 앱을 닫으면 알림을 놓치기 때문이다. 발표에서 "알림 기능이 있다"로 뭉뚱그리지 말 것.

**외부 API는 `app/api/`의 서버리스 프록시를 거친다 (브라우저 직접 호출 금지).** 공공데이터포털·OpenWeatherMap 키를 번들에 노출시키지 않고 CORS도 피하기 위한 계층이다. Vercel이 `app/api/*.js`를 서버리스 함수로 자동 인식하고, `app/vite.config.js`의 `local-api-routes` 플러그인이 **같은 핸들러를 dev 미들웨어로도 마운트**해서 `npm run dev`와 배포본이 같은 `/api/*` 경로를 쓴다(`vercel dev` 불필요). 키는 `app/.env`에 **`VITE_` 접두사 없이** 둔다 — 접두사를 붙이면 클라이언트 번들에 박힌다. 배포 시 Vercel 프로젝트 환경변수에도 같은 이름으로 넣어야 한다.

- `app/api/tour.js` — 한국관광공사 관광정보서비스_GW. **`KorService2`(국문)를 쓴다.** `RusService2`(노어)는 `resultCode 0000`으로 정상 응답하지만 `totalCount`가 모든 질의에서 0이라 사실상 비어 있다(같은 키로 두 서비스 모두 호출된다). `*Service1`은 폐기됨.
  - `searchFestival2`의 `eventStartDate`는 **시작일이 그 날짜 이후인** 행사만 준다. 오늘 날짜를 넣으면 이미 진행 중인 축제가 전부 빠지므로, 180일 전부터 받아 **종료일이 지난 것을 직접 걸러낸다**.
  - `searchFestival2`는 **`areacode`를 빈 문자열로 반환**한다. `areaCode` 파라미터를 붙이면 결과가 거의 0건이 되므로 전국을 받아 `addr1`에서 지역을 유도한다(`_area.js`의 `regionFromAddr`). 주소에 시/도 접두어가 없는 건(예: `포항시 북구 …`)은 **요청 지역으로 떨어뜨리지 말고 제외**할 것 — 떨어뜨리면 모든 지역에 동시에 노출된다. `areaBasedList2`는 `areacode`가 정상이라 이 처리가 필요 없다.
- `app/api/linkmeta.js` — 붙여넣은 URL의 제목·썸네일 조회(퇴근길 저장함). **키가 필요 없는데도 프록시를 쓰는 유일한 경우** — 브라우저에서 유튜브/쇼핑몰을 직접 fetch하면 CORS에 막힌다. 유튜브는 oEmbed(키 불필요)로 제목을, 썸네일은 `img.youtube.com/vi/<id>/hqdefault.jpg`로 주소만 조합해 얻는다. 그 외 사이트는 OG 태그를 긁는데, **쿠팡·마켓컬리·SSG는 봇 요청을 막아 제목이 `null`로 온다** — 실패로 취급하지 말고 사용자가 직접 제목을 적게 두는 것이 정상 경로다.
- `app/api/weather.js` — OpenWeatherMap(기상청이 아니다). `/weather`와 `/forecast`를 병렬 호출한다: 현재 기온·상태는 실황에서, **오늘 최저/최고와 강수확률은 예보에만 있다**. `_grid.js`는 시/도 대표 **위경도**(기상청 격자 nx/ny가 아니다). `condition` 문자열의 `rain` 접두사로 `buildRecommendation()`이 우비를 판단하므로, **눈(6xx)에는 `rain` 접두사를 붙이지 않는다** — 눈에는 우비가 아니라 기온 기반 겉옷 추천이 맞다.

`screens/` has **not** been migrated or connected to Supabase — it's still the standalone localStorage version, and both versions now coexist. Don't wire real backend calls into `screens/` without confirming with the user first.

There is no test suite anywhere. Available verification:

For `screens/` (static version):
- `node --check screens/js/<file>.js` for syntax
- Actually serving `screens/` (e.g. `python -m http.server <port>` from inside `screens/`, or the VS Code Live Server config in `.vscode/settings.json`, port 5501) and driving it in a real/headless browser — this repo has no dev-server script, so start one manually.

For `app/` (React version) — run these from `app/`:
- `npm run build` (Vite; catches syntax/import errors) and `npm run lint` (oxlint). A pre-existing non-blocking `react(only-export-components)` warning on `FamilyContext.jsx` is expected — it's the `useFamily` hook exported alongside the provider.
- `npm run dev` (port 5173). Vite serves the SPA fallback for deep links; production needs the rewrite in `app/vercel.json` instead.
- **RLS / backend behavior is best verified with `curl` against the REST API**, which is much faster than clicking through the UI and is the only way to confirm policy behavior directly. Pattern: `curl "$VITE_SUPABASE_URL/rest/v1/<table>?select=*" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "x-family-id: <uuid>"`. Add `-H "Prefer: return=representation"` to reproduce what supabase-js's `.select()` does after a write. Note that a *wrong* `x-family-id` yields `200 []` and a delete affecting 0 rows still returns `204` — absence of an error does **not** mean the operation did anything, so assert on the resulting row state, not the status code.
- **`/api/*` 프록시도 `curl`로 검증한다**: `curl "http://localhost:5173/api/tour?region=%EC%84%9C%EC%9A%B8&contentTypeId=15"`. 공공데이터포털은 장애·키 문제도 **HTTP 200 + XML 에러 문서**로 돌려주므로 상태 코드가 아니라 본문을 봐야 한다(`_serviceKey.js`의 `fetchJson`이 파싱 실패 시 본문을 실어 올린다). 프록시를 건너뛰고 상류를 직접 치면 원인 구분이 빠르다.
- **`npm run dev`를 백그라운드로 띄웠으면 반드시 죽일 것.** 좀비 서버가 5173을 물고 있으면 새 인스턴스가 5174, 5175…로 밀려나고, `curl localhost:5173`은 **수정 전 코드**에 계속 붙는다. 코드가 멀쩡한데 고쳐도 안 고쳐지는 것처럼 보이는 전형적인 함정이다. `netstat -ano | grep ':517'`로 확인하고 `taskkill //F //PID <pid>`로 정리한다.
- Anything visual (animations, the child-todo progress marker, layout) can only be verified by actually driving a browser; build/lint/curl will not catch it.

## Architecture

**Multi-page app, one `.html` file per screen, all living in `screens/`.** Every page repeats the same `<head>` boilerplate: Google Fonts (Nanum Gothic / Gowun Dodum / Gaegu), Phosphor Icons via `unpkg`, and an identical inline `tailwind.config` (color tokens, font families, radii, shadow) copied from `design-system/MASTER.md`. **There is no shared template** — when a design token changes, it must be edited in every page's inline `<script>` block.

**Shared client-side "backend" — `js/store.js`:** a single `window.OFStore` object that owns all app state, persisted to `localStorage` under `ourfamily_store_v1` and seeded from an in-file `DEFAULTS` object on first load. Domains: `todos`, `fridge`, `info` (categories + items), `weekend` (activities), `outfit` (weekly outfit rules), `chat`. Every mutation calls `persist()`, which writes to `localStorage` and fires a `window` `of:change` CustomEvent — pages subscribe via `OFStore.onChange(fn)` and re-render their own DOM from `OFStore.*.list()`/`.get*()` on every change (there's no framework/virtual DOM; each page hand-rolls its own `render()` that rebuilds `innerHTML` from store state). New data added by one page (e.g. the chatbot) is immediately visible on any other open page after its own `of:change` handler re-renders.

**Chatbot (`js/chatbot.js`), included on every page:** builds a floating button + slide-up panel and runs a **rule-based Korean NLU parser** (no LLM) — regex-driven domain detection (todo/fridge/outfit/info/weekend) → intent detection (add/edit/delete/query) → entity extraction (time via `extractAllTimes`, quoted strings via `extractQuoted`, member names, region names) → dispatches to a `handle<Domain>()` function that calls into `OFStore` and returns a Korean reply string. This was a deliberate choice over an LLM integration (asked and confirmed) — when extending it, keep new domains inside `detect()`/`handle*()` following the existing pattern rather than introducing a different parsing approach. Chat log itself is mirrored to `sessionStorage` so the conversation persists across page navigation within a tab.

**Bottom nav (`js/bottomnav.js`), included on every page:** injects a fixed 5-tab bar (홈/할일/정보/주말/아지트). The "할일" tab target is context-sensitive — `child-outfit.html`/`child-todo.html` route to `child-todo.html`, everything else routes to `parent-tasks.html`. Active-tab highlighting matches on `location.pathname`'s filename. The chatbot's floating button is deliberately positioned at `bottom-20` (not `bottom-6`) to clear this bar — keep that offset if either component's height changes.

**Mock external-API layer (`js/weather.js`, `js/tourapi.js`, `js/config.js`):** `config.js` defines `window.OF_CONFIG = { weatherApiKey, tourApiKey }`, currently both `null`. Each module branches on whether its key is set: `null` → resolves a mock Promise shaped like the real API's expected response; a key present → calls a `fetchReal()` stub that currently just rejects with an explanatory message. This is intentional scaffolding for 기상청 (weather) and 한국관광공사 TourAPI, chosen because real calls from a browser would hit CORS/key-exposure issues and need a server proxy that doesn't exist yet — don't wire real `fetch()` calls into these without first setting up that proxy and discussing it with the user. **이 문단은 `screens/`에만 해당한다** — `app/`은 그 프록시(`app/api/`)를 실제로 갖췄고 실 API에 붙어 있다.

**Page-specific game logic lives inline in `family-room.html`** (합이 15 / 계산 빙고 / 계단 오르기 — all turn-based; the PRD explicitly excludes reaction-speed/action games), rather than in a shared JS file, since it's not reused elsewhere.

## Conventions to follow when adding a page or feature

- Copy an existing page's `<head>` verbatim rather than re-deriving the Tailwind config.
- Include `js/store.js`, then `js/bottomnav.js`, then `js/chatbot.js` near the end of `<body>` (config/weather/tourapi scripts go between `store.js` and any page-specific inline script, only on pages that need them).
- Any new data domain belongs in `js/store.js` (DEFAULTS + load()-migration + a namespaced API object), not scattered `localStorage` calls in page scripts.
- If the new page should be globally reachable, add a tab in `js/bottomnav.js`'s `buildTabs()` (and adjust the `grid-cols-N` count to match the new tab total).
- No comments in code unless explaining a non-obvious constraint; this codebase currently has none beyond that bar.
