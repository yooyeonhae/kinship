---
name: 우리가족 올인원
generated_with: ui-ux-pro-max (search.py --design-system), curated manually
stack: html-tailwind
version: 2 — 콜라주/스크랩북 리스킨 (v1: 아침 해 웜톤, 아래 changelog 참고)
dials:
  variance: 6   # v1(4)보다 대담해짐 — 콜라주는 비대칭·장식이 핵심이라 중심을 조금 더 씀
  motion: 3     # 그대로 — 바쁜 아침엔 절제된 반응 속도가 우선
  density: 3    # 그대로 — 한눈에 훑어보기
colors:
  background: '#FAF8F5'
  surface: '#FFFFFF'
  surface-muted: '#F1ECE4'
  foreground: '#2B2A28'
  foreground-muted: '#5C5852'
  border: '#E7DFD3'
  primary: '#0055FF'
  primary-dark: '#0044CC'
  on-primary: '#FFFFFF'
  secondary: '#2E7D32'
  on-secondary: '#FFFFFF'
  accent: '#C2185B'
  on-accent: '#FFFFFF'
  destructive: '#C6483B'
  on-destructive: '#FFFFFF'
  ring: '#0055FF'
  member-1: '#0055FF'
  member-2: '#C2185B'
  member-3: '#2E7D32'
  member-4: '#6A4C93'
  tape-blue: '#0055FF'
  tape-lime: '#4CAF50'
  tape-yellow: '#FFD100'
  tape-pink: '#FF85A1'
typography:
  display:
    fontFamily: "'Nanum Gothic', 'Varela Round', sans-serif"
    weight: 800
    size: 28px
    lineHeight: 34px
  heading:
    fontFamily: "'Nanum Gothic', 'Varela Round', sans-serif"
    weight: 700
    size: 22px
    lineHeight: 28px
  body-lg:
    fontFamily: "'Gowun Dodum', 'Nunito Sans', sans-serif"
    weight: 400
    size: 17px
    lineHeight: 26px
  body:
    fontFamily: "'Gowun Dodum', 'Nunito Sans', sans-serif"
    weight: 400
    size: 15px
    lineHeight: 22px
  label:
    fontFamily: "'Nanum Gothic', 'Varela Round', sans-serif"
    weight: 700
    size: 13px
    lineHeight: 18px
  doodle:
    fontFamily: "'Gaegu', cursive"
    weight: 700
    size: 15px
    lineHeight: 20px
radius:
  sm: 10px
  md: 16px
  lg: 20px
  full: 9999px
spacing:
  page-margin: 24px
  section-gap: 32px
  card-padding: 20px
  gutter: 16px
  touch-min: 48px
---

# 우리가족 올인원 — 디자인 시스템 (MASTER)

## 스코프 밖 — 나중에 고려할 수 있는 기능 (지금 화면엔 없음)

무드보드 프롬프트 중 일부는 지금 6개 화면·페르소나 페인포인트에 없는 기능을 그려서 왔다. 억지로 기존 화면에 끼워 넣지 않고 여기에만 메모해둔다 — 실제로 만들게 되면 새 화면으로 따로 설계해야 한다.

- **가족 원격 소통/무드보드**: 사무실의 부모 ↔ 집의 아이를 하트로 연결하는 "Miss You!" 형태의 감성 메시지 기능. 지금 앱은 "아침에 뭘 챙길지"에 집중돼 있고, 재택이 아닌 원격근무 상황이나 정서적 메시지 교환은 페르소나 워크시트의 페인포인트 5개 어디에도 근거가 없음.
- (참고: 이전 라운드에서 나온 "저녁 사진 공유"·"게임/휴식 존" 컨셉도 같은 이유로 보류됨.)

## Changelog

**v3 (이번 업데이트)** — `kinship/*.png` 실제 목업과 다시 대조해서, 카드/버튼/헤더를 그 이미지에 더 가깝게 맞췄다. 하단 5탭 네비게이션(`bottomnav.js`)과 아이콘 기반 아바타(실사진 없음)는 그대로 유지하고, **레이아웃 구조가 아니라 카드 스타일·색·헤더 크롬만** 바꿨다.

- **공용 상단 헤더** (모든 화면 공통, 새로 추가): 좌측에 `Kinship` 워드마크(진한 그린, `font-display font-extrabold`), 우측에 지구본 아이콘(언어) + 계정 아이콘. 얇은 `border-b border-border` 하나로 구분. entry.html의 콜라주 히어로 배너는 이 헤더로 교체한다 — 브랜드명이 "우리가족"에서 실제 제품명 `Kinship`(레포/Supabase 프로젝트명과 일치)으로 정리됨.
  ```html
  <header class="flex items-center justify-between px-1 py-2 mb-6 border-b border-border">
    <span class="font-display font-extrabold text-2xl text-secondary">Kinship</span>
    <div class="flex items-center gap-4 text-foreground-muted">
      <i class="ph ph-globe text-xl" aria-hidden="true"></i>
      <i class="ph ph-user-circle text-xl" aria-hidden="true"></i>
    </div>
  </header>
  ```
- **스티커 컷아웃 카드 스타일** (화면당 주인공 카드 1~2개에만 — 전부 적용 시 산만해짐): `border-2 border-foreground` + 새 `shadow-sticker` 토큰(부드러운 blur 대신 단색 하드 오프셋 그림자, 스티커를 오려 붙인 느낌). 기존 `shadow-soft`는 나머지 카드에 그대로 유지.
  ```js
  boxShadow: {
    soft: '0 2px 8px rgba(43,42,40,0.06), 0 8px 24px rgba(43,42,40,0.08)',
    sticker: '4px 4px 0 0 #2B2A28',
  }
  ```
- **CTA 그린이 더 진해짐**: 새 토큰 `secondary-dark: '#1B4D3A'` — 확인/완료 계열 primary 버튼(예: "확인했어요!", "확인(To Tasks)")에 사용. 기존 `secondary #2E7D32`는 배지·태그 등 작은 요소에 계속 사용.
- **마커 하이라이트 제목**: 섹션 제목 일부 배경에 `bg-tape-yellow/70`를 얇게 깔아 형광펜 효과. 예: `<span class="bg-tape-yellow/70 px-1 -rotate-1 inline-block">오늘의 지정복</span>`. 기존 규칙(옐로우엔 항상 진한 `foreground` 텍스트) 그대로 적용.
- **긴급/경고 카드**: `destructive` 테두리(`border-2 border-destructive`) + 좌측 굵은 컬러 바 1개로 "오늘 마감" 같은 항목 강조 (예: parent-tasks 화면의 "Pay daycare invoice").
- **풀컬러 카드 배경(파스텔)**: entry.html처럼 카드 전체를 색으로 채우는 경우, 채도 높은 `member-*`/`tape-*`가 아니라 새로 추가한 연한 파스텔 토큰을 쓴다 — `pastel-mint: '#BFEAD1'`, `pastel-sky: '#BEE7F5'`. 이 위엔 항상 `text-foreground`(진한 잉크색)로 텍스트를 얹는다(연한 배경이라 대비 충분).
- **사진 자리(placeholder)**: 실사 이미지가 아직 없는 곳(가족 아바타, 옷/음식 사진)은 `surface-muted` 배경에 큼직한 Phosphor 아이콘을 중앙에 놓은 사각/원형 블록으로 채운다. 나중에 실제 이미지로 교체하기 쉽도록 `data-photo-slot="설명"` 속성을 붙여둔다 (예: `data-photo-slot="member-avatar-leo"`, `data-photo-slot="recipe-bulgogi"`) — 아직 기능은 없지만 다음 작업에서 실제 이미지를 꽂아 넣을 자리를 코드에서 바로 찾을 수 있게 하기 위함.
- 워시테이프/회전 등 v2의 콜라주 장식 언어는 유지하되, 새 스티커 카드와 같은 요소에 동시에 몰아넣지 않는다(택1).

**v2 (이전 업데이트)** — 사용자가 지정한 새 스타일 브리프(포토리얼 라이프스타일 사진 + 콜라주/독들·워시테이프·스티커 + 코발트블루/라임그린/브라이트옐로우/로즈핑크)로 팔레트와 장식 언어를 교체. v1의 "아침 해" 톤(번트오렌지 계열)은 폐기.

**v1** — 웜아이보리 배경 + 번트오렌지/세이지그린 팔레트, "Soft Tactile" 미니멀 스타일. 접근성 보정(흰 텍스트 대비 4.5:1) 작업까지 마쳤던 버전. 참고용으로 changelog에만 남김.

> 참고: 이 프로젝트에는 `kinship_collage/DESIGN.md`라는 예전 스크랩북 스타일 문서가 이미 있었다(포레스트그린/펄스핑크/워시테이프). 이번 브리프는 같은 "콜라주·스티커·손글씨" 방향인데 팔레트가 다르다(코발트블루/라임/옐로우/로즈핑크). 아래는 그 kinship_collage 취지를 이번에 지정된 새 팔레트로 다시 구현한 버전이다.

## 왜 이 팔레트를 그대로 안 쓰고 보정했는가

브리프에서 준 4가지 액센트 — 코발트블루 `#0055FF`, 라임그린 `#4CAF50`, 브라이트옐로우 `#FFD100`, 로즈핑크 `#FF85A1` — 를 흰 글자와 같이 버튼에 그대로 칠해보면:

| 색 | 흰 텍스트 대비 | 결과 |
|---|---|---|
| 코발트블루 `#0055FF` | 5.6:1 | ✅ 통과 — 그대로 메인 CTA(`primary`)로 사용 |
| 라임그린 `#4CAF50` | 2.8:1 | ❌ 실패 |
| 브라이트옐로우 `#FFD100` | 1.5:1 | ❌ 크게 실패 (밝은 색이라 흰 글자와 거의 안 보임) |
| 로즈핑크 `#FF85A1` | 2.3:1 | ❌ 실패 |

그래서 이 4가지 색은 **역할을 분리**했다:
- **코발트블루**만 실제 버튼/CTA(`primary`)로 쓴다. 나머지 셋은 원색 그대로 두되 `tape-*` 토큰으로 이름 붙여 **테이프·스티커·마커 같은 순수 장식**에만 쓴다 (텍스트를 직접 얹지 않으므로 대비 규정에서 자유롭다 — WCAG는 의미를 전달하지 않는 순수 장식 요소엔 대비 기준을 적용하지 않음).
- 그래도 초록/핑크가 "완료 상태" 배지나 "아이 태그"처럼 **글자를 얹어야 하는 자리**엔 필요해서, 같은 색감의 진한 버전을 새로 만들었다: `secondary #2E7D32`(진한 그린, 대비 5.1:1), `accent #C2185B`(진한 로즈, 대비 5.9:1). 브라이트옐로우는 흰 텍스트용 버전을 만들지 않고, 대신 **어두운 글자를 얹는 형광펜(하이라이터) 용도**로만 쓴다 — 그건 오히려 실제 마커펜이 종이 위에서 작동하는 방식과 똑같다.

## 톤 한 줄 요약

> 사진첩처럼 쌓인 가족의 하루 — 살짝 삐뚤어진 테이프, 손글씨 낙서, 스티커 자국들 사이로 오늘 할 일이 보인다. 발랄하지만 아침에 3초 안에 읽혀야 한다는 원칙은 그대로.

## 컬러

| 토큰 | HEX | 용도 |
|---|---|---|
| `background` | `#FAF8F5` | 화면 배경 (웜 크림/오프화이트) |
| `surface` | `#FFFFFF` | 카드 배경 |
| `surface-muted` | `#F1ECE4` | 인풋, 보조 패널 |
| `foreground` | `#2B2A28` | 본문 텍스트 |
| `foreground-muted` | `#5C5852` | 보조 텍스트, 캡션 |
| `border` | `#E7DFD3` | 구분선, 카드 테두리 |
| `primary` | `#0055FF` | 메인 CTA — 유일하게 흰 텍스트에 안전한 브리프 원색 |
| `secondary` | `#2E7D32` | 완료/체크/긍정 상태 (라임그린의 텍스트-안전 버전) |
| `accent` | `#C2185B` | 강조 배지, 경고성 하이라이트 (로즈핑크의 텍스트-안전 버전) |
| `destructive` | `#C6483B` | 삭제/에러 |
| `ring` | `#0055FF` | 포커스 링 |
| `member-1..4` | 블루·로즈·그린·바이올렛 | 가족 구성원 색 태그 (전부 흰 텍스트 대비 통과) |
| `tape-blue/lime/yellow/pink` | 브리프 원색 그대로 | **장식 전용** — 워시테이프, 스티커, 마커 밑줄. 그 위에 텍스트를 얹지 않는다 |

**규칙**
- `tape-*` 위에는 절대 텍스트를 얹지 않는다 (얹어야 하면 `secondary`/`accent`/`foreground`의 진한 버전을 쓴다).
- `tape-yellow`가 텍스트 배경(형광펜 효과)으로 쓰일 때는 반드시 `foreground`(진한 잉크색) 텍스트와 짝을 이룬다 — 대비 10:1 이상으로 가장 안전한 조합.
- 화면당 `primary` CTA는 하나만.
- 색만으로 상태를 표현하지 않기 — 완료/미완료는 색 + 아이콘 + 텍스트를 항상 같이.

## 콜라주 장식 언어 (이번에 새로 추가된 부분)

지금까지의 "미니멀 카드" 틀은 유지하되, 아래 세 가지 장식 요소를 더해 스크랩북 질감을 낸다. 전부 `aria-hidden="true"`로 순수 장식임을 명시하고, 정보를 담지 않는다(정보는 항상 텍스트/아이콘으로 따로 전달).

1. **워시테이프**: 카드 모서리에 살짝 기울어진(-4~6deg) 얇은 색 띠(`tape-*` 색, 폭 40~56px, 높이 16~20px, 반투명 90%). 카드가 "붙여진" 느낌을 준다.
2. **손글씨 낙서(doodle)**: 중요 숫자/문구 아래에 SVG로 그린 손그림풍 밑줄이나 동그라미(두께 2.5~3px, `tape-*` 색 1개, 살짝 삐뚤빼뚤한 path). 강조하되 절대 유일한 정보 전달 수단이 되지 않는다.
3. **스티커 아바타**: 기존 원형 멤버 태그를 그대로 쓰되, 흰 테두리(die-cut 느낌, `ring-4 ring-surface`)와 살짜 그림자를 더해 "인쇄된 스티커를 붙인" 느낌을 낸다.
4. **손글씨 캡션(선택적)**: `Gaegu` 폰트로 짧은 감정 캡션 한두 마디만("오늘도 힘내요!") — 본문/제목에는 절대 쓰지 않는다(가독성 우선, 아침에 훑어봐야 함).
5. **약한 회전**: 카드 1~2개에만 `-1deg`~`1deg` 정도의 미세한 회전을 줘서 완벽한 격자가 아닌 손으로 붙인 느낌을 낸다. 전부 회전시키면 산만해지므로 화면당 1개 요소에만 제한.

**포토리얼 라이프스타일 사진에 대한 메모**: 브리프의 "Photorealistic lifestyle photography"는 실제 사진/AI 생성 이미지가 필요한 부분이라, 지금 이 HTML 목업엔 실제 사진 대신 아이콘 자리로 대체돼 있다. 나중에 사진을 채울 자리(레시피 카드 상단, 완료 화면 배경 등)는 이 무드로 — **다크한 배경이 아니라 밝고 자연광 느낌, 따뜻한 실내, 손·음식·옷 등 클로즈업** — 찍거나 생성해서 넣는다. (다크 네이비+네온 시네마틱 무드는 이전에 별도로 제안됐다가 폐기됐다 — 이번 브리프의 밝은 크림 배경과는 다른 방향이니 혼동하지 않기.)

## 타이포그래피

| 역할 | 폰트 | 굵기 | 크기/행간 |
|---|---|---|---|
| Display (화면 타이틀) | Nanum Gothic | 800 | 28px / 34px |
| Heading (섹션 제목) | Nanum Gothic | 700 | 22px / 28px |
| Body-lg (핵심 정보) | Gowun Dodum | 400 | 17px / 26px |
| Body (일반 본문) | Gowun Dodum | 400 | 15px / 22px |
| Label (eyebrow, 태그) | Nanum Gothic | 700 | 13px / 18px |
| Doodle (손글씨 캡션, 장식 전용) | Gaegu | 700 | 15px / 20px |

**Google Fonts import**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&family=Gowun+Dodum&family=Gaegu:wght@700&display=swap" rel="stylesheet">
```

Gaegu는 손글씨 폰트라 작은 캡션 한두 마디에만 쓴다 — 본문/제목에 쓰면 바쁜 아침에 읽는 속도가 떨어진다.

## 모션 — 아이 화면 생동감/리워드 예외 (이번에 추가)

`motion: 3` 다이얼은 그대로 유지한다 — 부모 화면(할일/레시피/현황)은 여전히 탭 반응(active:scale) 외엔 애니메이션 없음. 다만 **아이가 직접 보는 화면**은 "위트있게 움직이는" 인상이 몰입/흥미유발에 직접 기여한다고 보고, 다음 세 곳에만 예외적으로 idle/리워드 모션을 추가했다:

- **child-todo.html** — 할일 체크 시 원·별 아이콘이 pop 바운스, 진행 바 별 스티커가 회전하며 채워짐, 전부 완료하면 문구가 살짝 튀어오르며 등장. (JS로 상태 토글 + 클래스 재생 방식, `#todo-list`/`#progress-stars` 참고)
- **child-outfit.html** — 날씨 아이콘 idle sway, "Today's Outfit!" 테이프 wiggle, 옷차림 카드 2개가 순서대로 pop-in.
- **entry.html** — 히어로의 별/스파클 twinkle, 가족 아바타 4개 idle bob(스태거 딜레이), 워드마크 1회 pop-in 등장.

**규칙**
- 전부 `prefers-reduced-motion: reduce`에서 기존 전역 규칙(`animation-duration: 0.01ms !important`)으로 억제됨 — 이 화면들에 넣은 CSS keyframe도 예외 없이 이 규칙의 셀렉터(`*, *::before, *::after`) 안에 걸린다.
- 정보를 전달하는 요소(텍스트, 상태값)엔 흔들림만 얹지 완전히 대체하지 않는다 — 예: 별 카운트 텍스트는 항상 동시에 갱신됨.
- 위치를 좌우하는 Tailwind 변형 유틸(`translate-x-[…]`, `rotate-[…]`)과 idle 애니메이션을 같은 엘리먼트에 직접 걸면 `transform` 전체가 애니메이션 쪽으로 덮여 위치가 깨진다 — 그래서 entry.html 아바타는 위치/회전을 담당하는 바깥 `div`는 그대로 두고, 안쪽에 `avatar-bob`용 `span`을 하나 더 감싸는 방식으로 분리했다. 비슷한 패턴이 필요하면 이 방식을 그대로 따른다.
- 부모 화면에는 이 패턴을 확산하지 않는다 — 부모는 속도가 우선이라는 원래 원칙(`motion: 3`)이 여전히 기본값.

## 아이콘

- Phosphor Icons, duotone(감정/상태) + regular(내비게이션) 조합 — 이전과 동일.
- 이모지 금지.

## 모양 & 그림자

- Radius: `sm 10px` · `md 16px` · `lg 20px` · `full`.
- Shadow: `shadow-soft` (부드러운 단일 방향) 그대로 유지 — 콜라주 느낌은 테이프/스티커/회전으로 내고, 그림자 자체는 과하게 만들지 않는다(너무 각 카드에 진한 그림자+회전+테이프가 겹치면 지저분해짐).

## 컴포넌트 패턴 (화면 흐름 매핑) — v1과 동일한 화면 구조, 스킨만 교체

0. **히어로 배너 (entry.html 상단)** — 그라디언트+흰 아웃라인으로 만든 "버블 텍스트" 워드마크(`우리가족`), 워시테이프 2개, 별/스파클 스티커, 가족 구성원 4명의 스티커 아바타를 워드마크 주변에 콜라주처럼 배치. 브리프의 "포토리얼 컷아웃 가족 사진"은 실제 사진 자산이 없어 아이콘 기반 스티커 아바타로 대체했다 — 나중에 실제 가족 사진을 구하면 이 자리에 원형으로 잘라 넣으면 된다.
1. **첫 화면(분기)** — 자녀 카드에 스티커 아바타 + 워시테이프 1개.
2. **옷차림 추천** — 온도 숫자에 손글씨 동그라미 낙서. 체육복 배지는 `accent` 솔리드.
3. **아이 할일 체크** — 완료 체크는 `secondary`. 전부 다 하면 뜨는 문구에 `doodle` 폰트로 짧게.
4. **저녁 레시피** — 카드 상단 이미지 자리(지금은 아이콘)에 워시테이프 모서리 장식.
5. **가족 할일 리스트** — 자주 쓰는 항목 칩은 그대로, 카드 중 1개만 살짝 회전.
6. **완료 현황** — 진행 트랙은 그대로, 두 부모 스티커 아바타의 흰 테두리를 더 두껍게(die-cut 느낌).

## Tailwind 설정 (모든 화면 공통 — CDN 방식)

```html
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          background: '#FAF8F5', surface: '#FFFFFF', 'surface-muted': '#F1ECE4',
          foreground: '#2B2A28', 'foreground-muted': '#5C5852', border: '#E7DFD3',
          primary: '#0055FF', 'primary-dark': '#0044CC', 'on-primary': '#FFFFFF',
          secondary: '#2E7D32', 'secondary-dark': '#1B4D3A', 'on-secondary': '#FFFFFF',
          accent: '#C2185B', 'on-accent': '#FFFFFF',
          destructive: '#C6483B', 'on-destructive': '#FFFFFF', ring: '#0055FF',
          'member-1': '#0055FF', 'member-2': '#C2185B', 'member-3': '#2E7D32', 'member-4': '#6A4C93',
          'tape-blue': '#0055FF', 'tape-lime': '#4CAF50', 'tape-yellow': '#FFD100', 'tape-pink': '#FF85A1',
          'pastel-mint': '#BFEAD1', 'pastel-sky': '#BEE7F5',
        },
        fontFamily: {
          display: ["'Nanum Gothic'", "'Varela Round'", 'sans-serif'],
          body: ["'Gowun Dodum'", "'Nunito Sans'", 'sans-serif'],
          doodle: ["'Gaegu'", 'cursive'],
        },
        borderRadius: { sm: '10px', md: '16px', lg: '20px', full: '9999px' },
        boxShadow: {
          soft: '0 2px 8px rgba(43,42,40,0.06), 0 8px 24px rgba(43,42,40,0.08)',
          sticker: '4px 4px 0 0 #2B2A28',
        },
      },
    },
  };
</script>
```

## 배포 전 체크리스트

- [ ] 이모지 아이콘 금지 → Phosphor로 통일
- [ ] `tape-*` 색 위에 텍스트가 얹혀 있지 않은지 (장식 전용 규칙 위반 확인)
- [ ] 모든 실제 텍스트 대비 4.5:1 이상 확인
- [ ] 터치 영역 44×44px 이상
- [ ] 장식(테이프/회전/낙서)이 화면당 과하지 않은지 — 카드 1~2개에만, 전부 몰아넣지 않기
- [ ] `prefers-reduced-motion` 대응
- [ ] 포커스 링 키보드 탭 이동 시 보이는지
