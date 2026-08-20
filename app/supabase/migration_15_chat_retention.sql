-- migration_15 — 가족톡 7일 보관 후 자동 삭제
--
-- 아지트 채팅은 "오늘 늦어", "숙제 다 했어" 같은 일정 확인용이라 오래 둘 이유가 없다.
-- 쌓이면 (a) 처음 열 때 불러오는 양이 계속 늘고, (b) 지난 대화가 지워지지 않는 기록으로
-- 남는다. 7일이 지나면 지운다.
--
-- ── pg_cron 확장이 필요하다 ─────────────────────────────────────────────
-- Supabase Dashboard → Database → Extensions 에서 `pg_cron`을 켠 뒤 이 파일을 실행할 것.
-- 확장이 꺼져 있으면 아래 cron.schedule 호출에서 "schema cron does not exist"로 멈춘다.
-- (아래 delete_old_chat_messages()까지는 확장 없이도 만들어지므로, 급하면 그 함수만
--  만들어두고 SQL Editor에서 수동으로 호출해도 된다.)
-- ──────────────────────────────────────────────────────────────────────

-- security definer로 두는 이유: cron 작업에는 요청 헤더가 없어 current_family_id()가
-- null이 된다. RLS를 그대로 통과시키면 어떤 행도 못 지운다. 이 함수는 가족을 가리지 않고
-- "7일 지난 것"만 지우므로, 범위를 넓게 여는 대신 조건을 함수 안에 못박아 둔다.
create or replace function delete_old_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from chat_messages
  where created_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

-- 이 함수는 클라이언트가 부를 일이 없다. 열어두면 아무나 호출해 오래된 대화를
-- 임의로 지울 수 있으므로 실행 권한을 회수한다(cron은 postgres 권한으로 돈다).
revoke all on function delete_old_chat_messages() from public, anon, authenticated;

-- 매일 새벽 4시(UTC 19시 = KST 04시)에 한 번 돈다.
-- 같은 이름의 작업이 이미 있으면 지우고 다시 만든다 — 여러 번 실행해도 중복되지 않는다.
do $$
begin
  perform cron.unschedule('kinship-chat-retention');
exception when others then
  -- 아직 없으면 unschedule이 실패한다. 그건 정상이다.
  null;
end $$;

select cron.schedule(
  'kinship-chat-retention',
  '0 19 * * *',
  $$select delete_old_chat_messages()$$
);
