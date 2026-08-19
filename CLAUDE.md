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
- `migration_09_schedules.sql` — 아이 요일별 스케줄(`schedules`). `repeat_type`이 `weekly`면 `day_of_week`만, `once`면 `schedule_date`만 차야 한다(`schedules_when_check`) — 둘 다 비면 언제인지 알 수 없고 둘 다 차면 어느 쪽을 따를지 알 수 없다. `alarm_minutes`는 "몇 분 전"이고 null이면 알림 없음. 쓰기는 부모만(todos·weekly_outfit_rules와 같은 규칙).

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

**아지트의 게임판 자체는 아직 한 기기 안에서만 돈다.** 채팅·접속 표시·포인트는 기기 간에 동기화되지만, 합이 15/빙고/계단은 "선수1·선수2를 골라 한 화면에서 번갈아 하는" 핫시트 방식이다. 기기를 넘나드는 대전으로 만들려면 초대·참가·"지금 내 차례인가"까지 필요해서 화면 재설계가 따른다 — 발표에서 이 경계를 넘겨 말하지 말 것.

**"오늘의" 메뉴는 무작위가 아니라 날짜로 정한다** (`app/src/lib/recipes.js`의 `pickTodayRecipes`). 무작위로 뽑으면 (a) 새로고침할 때마다 바뀌어 "오늘의"가 아니게 되고, (b) 같은 날 가족끼리 서로 다른 메뉴를 봐서 "오늘 카레래" 같은 대화가 어긋난다. `recipe_id`로 정렬을 고정한 뒤 날짜 숫자로 인덱스를 잡으므로, 회전의 기준이 흔들리지 않게 `sortRecipes()`를 거치지 않고 목록을 넘기면 안 된다. `description`은 `"재료, 재료 / 한 줄 설명"` 한 줄에 담고 화면에서 `parseDescription()`이 재료 칩과 설명으로 나눈다 — 손으로 입력하는 칸이라 이 형식을 안 지킨 값도 들어오며, 그때는 전체가 설명이 된다.

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
