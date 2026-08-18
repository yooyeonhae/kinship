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

**데이터 구조**: 6개 테이블 — `families`(family_id, name) / `members`(family_id FK, name, role) / `weekly_outfit_rules`(member_id FK, day_of_week, outfit_type) / `todos`(family_id FK, title, assignee_member_id FK, is_done, completed_by FK, completed_at) / `recipes`(title, description — 가족 구분 없는 공용 테이블) / `favorite_links`(family_id FK, platform, url). 관계: families 1:N members, members 1:N weekly_outfit_rules, families 1:N todos, members 1:N todos(assignee/completed_by 두 역할), families 1:N favorite_links. 날씨는 외부 API 실시간 호출로 별도 저장하지 않음(의도적). 실제 DDL/RLS는 `app/supabase/schema.sql`·`app/supabase/policies.sql`에 구현되어 있고, Seoul 리전의 `kinship` 전용 Supabase 프로젝트에 적용됨(RLS는 family_id 기반 격리, 로그인 없이 `x-family-id` 헤더로 구분). `app/supabase/migration_01_families_delete.sql`(정책명 `families_delete_own_empty`)도 적용 완료 — **구성원이 하나도 없는 가족만** 삭제할 수 있다. `createFamily()`가 members insert에서 실패했을 때 이미 커밋된 빈 families 행을 되돌리는 용도이고, 구성원이 있는 가족은 API로 삭제할 수 없다(FK가 `on delete cascade`라 열어두면 앱에서 가장 파괴적인 권한이 된다). 정식 "가족 삭제" 기능이 필요해지면 이 정책을 넓히지 말고 부모 역할 확인이 들어간 별도 정책을 만들 것. 양방향 동작은 REST로 검증했다(빈 가족 → 실제 삭제됨 / 구성원 있는 가족 → 보호됨, 단 **둘 다 `204`를 반환**한다).

앞으로 정책·스키마를 추가할 때는 `app/supabase/`에 `migration_NN_*.sql`로 파일을 만들고, Dashboard의 SQL Editor에서 실행해야 반영된다(anon 키로는 정책 생성이 불가능하고, 이 환경에는 Supabase CLI·psql이 설치되어 있지 않다).

**확정된 기술스택** (8단계, 경량 버전 선택 — 로그인 없는 가족 내부용 웹앱이라 SSR/Edge Functions 불필요):
- 프론트엔드: React + Vite (정적 SPA)
- 백엔드/DB: Supabase (기본 테이블 + RLS만 사용)
- 배포: Vercel 무료 티어

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

The PRD's target stack (React/Vite/Supabase) has since been adopted in `app/`, with explicit user confirmation at each step. **`app/` is now a working React SPA, not just a scaffold:** a single `app/index.html` entry + `react-router-dom`, with all 9 screens ported from `screens/*.html` into `app/src/pages/*.jsx` and the shared chrome (`Layout` / `Header` / `BottomNav`) in `app/src/components/`. `app/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, gitignored) points at the dedicated `kinship` Supabase project.

**Supabase is wired for the 가족 할일 domain only.** `families` / `members` / `todos` are live (entry, child-outfit name lookup, child-todo, parent-tasks, parent-progress). Everything else is still hardcoded dummy data on purpose: 요일별 지정복(`weekly_outfit_rules`), 냉장고 재료(스키마에 테이블 자체가 없음), 레시피, 정보 피드, 주말 나들이, 아지트 채팅·게임. Don't assume a screen is connected just because it renders real-looking data.

**No login — `family_id` is the whole auth model.** `app/src/context/FamilyContext.jsx` owns it: stored in `localStorage` under `kinship_family_id`, sent as the `x-family-id` header by the client factory in `app/src/lib/supabaseClient.js`. `OnboardingScreen` creates the family; `App.jsx` gates every other route behind it and redirects to `/onboarding` when absent. `FamilyContext` also verifies the stored id still resolves to a real `families` row and self-clears if it doesn't (a stale id otherwise leaves the user stuck in an empty shell, because RLS returns `[]` rather than an error for a family that doesn't exist).

**부모/자녀 역할 게이팅은 현재 클라이언트 전용이며 강제력이 아니다.** `FamilyContext`가 "지금 누구로 쓰는 중인지"를 `currentMemberId`(localStorage `kinship_member_id`)로 들고 있고, `EntryScreen`에서 사람을 고를 때 설정된다. 이 값으로 `App.jsx`의 `RequireParent`(`/parent-tasks`, `/parent-progress`)와 `RequireChildSelf`(자녀는 자기 화면만, 부모는 모든 자녀 화면) 가드가 동작하고, `BottomNav`의 "할일" 탭 목적지도 URL 패턴이 아니라 역할로 결정된다. **다만 요청에 실려 나가는 건 여전히 `x-family-id` 하나뿐이라, DB는 부모와 자녀를 구분하지 못한다** — 즉 이 게이팅은 실수·오탐색 방지 수준이고, 홈에서 부모를 고르면 누구나 부모 화면에 들어갈 수 있다. 서버에서 실제로 강제하려면 `x-member-id` 헤더 + `current_member_role()` 기반 RLS + 자녀 완료 전용 RPC가 필요하다(권한 모델 B단계 3~4). 이 구분을 흐리지 말 것.

관련해서 `completed_by`는 담당자가 아니라 **체크한 사람**(`currentMemberId`)을 기록한다. 담당자를 넣으면 "누가 끝냈는지"가 항상 담당자가 되어 부부 완료 현황의 근거가 사라진다. 단 이 값도 아직 클라이언트가 보내는 값이라 신뢰 수준은 위와 같다.

**Non-obvious RLS constraint — don't "simplify" `createFamily()`.** Inserting into `families` must (a) supply a client-generated `family_id` (`crypto.randomUUID()`), (b) use a client whose `x-family-id` header already equals that id, and (c) **not** chain `.select()`. Reason: `.select()` makes PostgREST send `Prefer: return=representation`, and Postgres applies the SELECT policy to the `INSERT ... RETURNING` row. `families_select_own` requires `family_id = current_family_id()`, so a DB-generated id can never match the header and the entire INSERT is rolled back with `42501`. This was verified empirically (`return=minimal` → 201, `return=representation` → 42501). `todos` and `members` are immune because their policies are `FOR ALL`, which covers the returning-select too.

`screens/` has **not** been migrated or connected to Supabase — it's still the standalone localStorage version, and both versions now coexist. Don't wire real backend calls into `screens/` without confirming with the user first.

There is no test suite anywhere. Available verification:

For `screens/` (static version):
- `node --check screens/js/<file>.js` for syntax
- Actually serving `screens/` (e.g. `python -m http.server <port>` from inside `screens/`, or the VS Code Live Server config in `.vscode/settings.json`, port 5501) and driving it in a real/headless browser — this repo has no dev-server script, so start one manually.

For `app/` (React version) — run these from `app/`:
- `npm run build` (Vite; catches syntax/import errors) and `npm run lint` (oxlint). A pre-existing non-blocking `react(only-export-components)` warning on `FamilyContext.jsx` is expected — it's the `useFamily` hook exported alongside the provider.
- `npm run dev` (port 5173). Vite serves the SPA fallback for deep links; production needs the rewrite in `app/vercel.json` instead.
- **RLS / backend behavior is best verified with `curl` against the REST API**, which is much faster than clicking through the UI and is the only way to confirm policy behavior directly. Pattern: `curl "$VITE_SUPABASE_URL/rest/v1/<table>?select=*" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "x-family-id: <uuid>"`. Add `-H "Prefer: return=representation"` to reproduce what supabase-js's `.select()` does after a write. Note that a *wrong* `x-family-id` yields `200 []` and a delete affecting 0 rows still returns `204` — absence of an error does **not** mean the operation did anything, so assert on the resulting row state, not the status code.
- Anything visual (animations, the child-todo progress marker, layout) can only be verified by actually driving a browser; build/lint/curl will not catch it.

## Architecture

**Multi-page app, one `.html` file per screen, all living in `screens/`.** Every page repeats the same `<head>` boilerplate: Google Fonts (Nanum Gothic / Gowun Dodum / Gaegu), Phosphor Icons via `unpkg`, and an identical inline `tailwind.config` (color tokens, font families, radii, shadow) copied from `design-system/MASTER.md`. **There is no shared template** — when a design token changes, it must be edited in every page's inline `<script>` block.

**Shared client-side "backend" — `js/store.js`:** a single `window.OFStore` object that owns all app state, persisted to `localStorage` under `ourfamily_store_v1` and seeded from an in-file `DEFAULTS` object on first load. Domains: `todos`, `fridge`, `info` (categories + items), `weekend` (activities), `outfit` (weekly outfit rules), `chat`. Every mutation calls `persist()`, which writes to `localStorage` and fires a `window` `of:change` CustomEvent — pages subscribe via `OFStore.onChange(fn)` and re-render their own DOM from `OFStore.*.list()`/`.get*()` on every change (there's no framework/virtual DOM; each page hand-rolls its own `render()` that rebuilds `innerHTML` from store state). New data added by one page (e.g. the chatbot) is immediately visible on any other open page after its own `of:change` handler re-renders.

**Chatbot (`js/chatbot.js`), included on every page:** builds a floating button + slide-up panel and runs a **rule-based Korean NLU parser** (no LLM) — regex-driven domain detection (todo/fridge/outfit/info/weekend) → intent detection (add/edit/delete/query) → entity extraction (time via `extractAllTimes`, quoted strings via `extractQuoted`, member names, region names) → dispatches to a `handle<Domain>()` function that calls into `OFStore` and returns a Korean reply string. This was a deliberate choice over an LLM integration (asked and confirmed) — when extending it, keep new domains inside `detect()`/`handle*()` following the existing pattern rather than introducing a different parsing approach. Chat log itself is mirrored to `sessionStorage` so the conversation persists across page navigation within a tab.

**Bottom nav (`js/bottomnav.js`), included on every page:** injects a fixed 5-tab bar (홈/할일/정보/주말/아지트). The "할일" tab target is context-sensitive — `child-outfit.html`/`child-todo.html` route to `child-todo.html`, everything else routes to `parent-tasks.html`. Active-tab highlighting matches on `location.pathname`'s filename. The chatbot's floating button is deliberately positioned at `bottom-20` (not `bottom-6`) to clear this bar — keep that offset if either component's height changes.

**Mock external-API layer (`js/weather.js`, `js/tourapi.js`, `js/config.js`):** `config.js` defines `window.OF_CONFIG = { weatherApiKey, tourApiKey }`, currently both `null`. Each module branches on whether its key is set: `null` → resolves a mock Promise shaped like the real API's expected response; a key present → calls a `fetchReal()` stub that currently just rejects with an explanatory message. This is intentional scaffolding for 기상청 (weather) and 한국관광공사 TourAPI, chosen because real calls from a browser would hit CORS/key-exposure issues and need a server proxy that doesn't exist yet — don't wire real `fetch()` calls into these without first setting up that proxy and discussing it with the user.

**Page-specific game logic lives inline in `family-room.html`** (합이 15 / 계산 빙고 / 계단 오르기 — all turn-based; the PRD explicitly excludes reaction-speed/action games), rather than in a shared JS file, since it's not reused elsewhere.

## Conventions to follow when adding a page or feature

- Copy an existing page's `<head>` verbatim rather than re-deriving the Tailwind config.
- Include `js/store.js`, then `js/bottomnav.js`, then `js/chatbot.js` near the end of `<body>` (config/weather/tourapi scripts go between `store.js` and any page-specific inline script, only on pages that need them).
- Any new data domain belongs in `js/store.js` (DEFAULTS + load()-migration + a namespaced API object), not scattered `localStorage` calls in page scripts.
- If the new page should be globally reachable, add a tab in `js/bottomnav.js`'s `buildTabs()` (and adjust the `grid-cols-N` count to match the new tab total).
- No comments in code unless explaining a non-obvious constraint; this codebase currently has none beyond that bar.
