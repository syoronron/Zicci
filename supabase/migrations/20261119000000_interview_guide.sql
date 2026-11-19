-- =====================================================================
-- 面接の進め方（質問フロー）
-- SQL Editor で実行してください（何回実行しても大丈夫です）。
-- =====================================================================

-- 店舗ごとに1つの質問フローを、項目の配列（JSON）として保存する。
-- 例: [{"id":"…","kind":"question","text":"志望動機を教えてください","hint":"…","options":[]}, …]
alter table public.stores
  add column if not exists interview_guide jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_interview_guide_is_array'
  ) then
    alter table public.stores
      add constraint stores_interview_guide_is_array
      check (jsonb_typeof(interview_guide) = 'array');
  end if;
end $$;
