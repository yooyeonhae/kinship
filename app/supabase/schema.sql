-- kinship (우리가족 올인원) initial schema
-- Source: docx/6단계_워크시트(가족소통앱).pdf
-- Run this in Supabase Dashboard → SQL Editor → Run

create extension if not exists "pgcrypto";

-- families: FK 대상으로 필요해 워크시트에 없던 최소 컬럼으로 추가
create table families (
  family_id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table members (
  member_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  name text not null,
  role text not null check (role in ('parent', 'child')),
  created_at timestamptz not null default now()
);

create table weekly_outfit_rules (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (member_id) on delete cascade,
  day_of_week text not null check (day_of_week in ('월', '화', '수', '목', '금', '토', '일')),
  outfit_type text not null,
  created_at timestamptz not null default now(),
  unique (member_id, day_of_week)
);

create table todos (
  todo_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  title text not null,
  assignee_member_id uuid references members (member_id) on delete set null,
  is_done boolean not null default false,
  completed_by uuid references members (member_id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- recipes: 가족 구분 없는 공용 테이블 (워크시트 명시)
create table recipes (
  recipe_id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table favorite_links (
  link_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (family_id) on delete cascade,
  platform text not null check (platform in ('유튜브', '쇼츠', '인스타')),
  url text not null,
  created_at timestamptz not null default now()
);

-- RLS 기본 활성화 (정책은 아직 없음 → 정책 추가 전까지 anon/authenticated 접근 전면 차단)
alter table families enable row level security;
alter table members enable row level security;
alter table weekly_outfit_rules enable row level security;
alter table todos enable row level security;
alter table recipes enable row level security;
alter table favorite_links enable row level security;
