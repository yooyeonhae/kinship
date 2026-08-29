-- migration_17 — 미니게임 '합이 15' 자리를 '끝말잇기'로 교체
--
-- game_key CHECK가 두 곳에 있다. 둘 다 넓히지 않으면
--   game_results  → 판이 끝나도 결과가 저장되지 않아 가족 포인트에 잡히지 않는다
--   game_sessions → 원격 대전 방 자체를 만들 수 없다
-- 한쪽만 고치면 "혼자서는 되는데 원격만 안 된다"처럼 보여서 원인을 찾기 어렵다.
--
-- 'sum15'를 열거에서 빼지 않는 이유: 화면에서는 사라졌지만 이미 저장된 전적이
-- 남아 있다. 값을 빼면 그 행들이 제약을 위반해 CHECK 추가 자체가 실패한다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table game_results
  drop constraint if exists game_results_game_key_check;

alter table game_results
  add constraint game_results_game_key_check
  check (game_key in ('sum15', 'bingo', 'stairs', 'updown', 'wordchain'));

alter table game_sessions
  drop constraint if exists game_sessions_game_key_check;

alter table game_sessions
  add constraint game_sessions_game_key_check
  check (game_key in ('sum15', 'bingo', 'stairs', 'updown', 'wordchain'));
