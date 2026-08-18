# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"우리가족 올인원" (family daily-planner PWA) — a school project (바이브코딩 기반 디지털플랫폼 제작). Target persona: a dual-income parent juggling kids' morning routine (weather/outfit, school prep), shared household todos, dinner recipes, and family communication while away from home.

**`prd.md` is the source of truth for scope and data model.** It also encodes development rules that apply to this repo specifically:
- Don't add features not listed in the PRD without asking first.
- Undecided items (e.g. which weather API, which turn-based games) must be confirmed with the user before building — never picked arbitrarily.
- Implement Must → Should → Could in that order.
- `kinship/*.png` are the binding visual reference for each screen's layout — not just inspiration; `design-system/MASTER.md` is the derived, currently-active design system (colors, type scale, "콜라주/스크랩북" decoration language, motion rules). `kinship_collage/DESIGN.md` is an earlier superseded draft — don't treat it as current.
- `docx/*단계_워크시트*.pdf` are the underlying school-assignment worksheets (persona research, benchmarking, journey map) that `prd.md` was distilled from — background only, not something code needs to read.

## Current implementation stage

This is **static HTML + vanilla JS + Tailwind CDN, with no build step, no bundler, no package.json for the app itself, and no real backend.** The PRD's target stack (React/Vite/Supabase) has not been adopted yet — everything currently runs client-side against `localStorage`. Treat this as an intentional, current-stage choice, not a shortcut to "fix": confirm with the user before introducing a framework/build step or wiring a real backend.

There is no lint or test suite. The only verification available is:
- `node --check screens/js/<file>.js` for syntax
- Actually serving `screens/` (e.g. `python -m http.server <port>` from inside `screens/`, or the VS Code Live Server config in `.vscode/settings.json`, port 5501) and driving it in a real/headless browser — this repo has no dev-server script, so start one manually.

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
