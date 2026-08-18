-- 확인용 SQL — SQL Editor는 마지막 SELECT 결과만 보여주므로 아래 3개를 하나씩 따로 실행해주세요.

-- 1) 테이블별 컬럼 목록
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('families', 'members', 'weekly_outfit_rules', 'todos', 'recipes', 'favorite_links')
order by table_name, ordinal_position;

-- 2) 테이블 간 관계(외래키) 목록
select
  tc.table_name as source_table,
  kcu.column_name as source_column,
  ccu.table_name as target_table,
  ccu.column_name as target_column,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
order by source_table, source_column;

-- 3) 테이블별 RLS 활성화 여부
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
