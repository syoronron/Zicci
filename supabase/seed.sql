-- =====================================================================
-- デモ用データ（ログイン機能ができるまでは、この1店舗で開発します）
-- 初期スキーマを実行したあとに、SQL Editor で実行してください。
-- =====================================================================

insert into public.stores (id, name, address, public_slug, interview_minutes, shift_buffer_minutes)
values (
  '00000000-0000-0000-0000-000000000001',
  'Zicci デモ店',
  '東京都渋谷区（デモ）',
  'demo',
  30,
  15
)
on conflict (id) do nothing;

-- 毎日の繁忙時間（ランチ・ディナー）
insert into public.store_blocks (store_id, weekday, start_time, end_time, kind)
select '00000000-0000-0000-0000-000000000001', null, s, e, 'busy'
from (values ('11:30'::time, '13:30'::time), ('17:30'::time, '20:00'::time)) as v(s, e)
where not exists (
  select 1 from public.store_blocks where store_id = '00000000-0000-0000-0000-000000000001'
);
