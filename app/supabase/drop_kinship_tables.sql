-- "오늘 뭐 입지" 프로젝트에 잘못 들어간 kinship 테이블만 제거.
-- children/clothes/profiles/daily_outfit_picks/dress_code_schedule/daily_messages/outfit_history 등
-- 기존 "오늘 뭐 입지" 앱 테이블은 건드리지 않습니다.

drop table if exists weekly_outfit_rules cascade;
drop table if exists todos cascade;
drop table if exists favorite_links cascade;
drop table if exists members cascade;
drop table if exists families cascade;
drop table if exists recipes cascade;
