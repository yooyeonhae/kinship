-- migration_06 — 미니게임에 '숫자 맞히기(업다운)' 추가
--
-- migration_05의 game_key CHECK가 세 게임만 열거하고 있어서, 새 게임의 결과는
-- INSERT 단계에서 제약에 걸린다. 게임을 추가할 때마다 여기를 넓혀야 한다.
--
-- 열거를 없애고 자유 문자열로 두지 않는 이유: game_key는 화면의 탭과 1:1로
-- 대응하는 값이라, 오타가 들어가면 그 판의 전적이 어느 게임에도 잡히지 않고
-- 조용히 사라진다. 게임이 늘어나는 속도보다 오타가 더 자주 생긴다.
--
-- Dashboard의 SQL Editor에서 실행할 것.

alter table game_results
  drop constraint if exists game_results_game_key_check;

alter table game_results
  add constraint game_results_game_key_check
  check (game_key in ('sum15', 'bingo', 'stairs', 'updown'));
