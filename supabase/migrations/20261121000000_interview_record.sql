-- =====================================================================
-- 面接の記録（応募者の回答・評価・メモ）
-- SQL Editor で実行してください（何回実行しても大丈夫です）。
-- =====================================================================

-- 予約ごとに、面接中の回答と評価を JSON で保存する（質問の文面も一緒に保存する）。
alter table public.reservations
  add column if not exists interview_record jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_interview_record_is_object') then
    alter table public.reservations add constraint reservations_interview_record_is_object
      check (interview_record is null or jsonb_typeof(interview_record) = 'object');
  end if;
end $$;
