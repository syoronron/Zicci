-- =====================================================================
-- 新しい予約の「代表者の確認」
-- SQL Editor で実行してください（何回実行しても大丈夫です）。
-- =====================================================================

-- 代表者が確認した日時。空（null）なら未確認＝ホームの「新しい予約」に出る
alter table public.reservations
  add column if not exists acknowledged_at timestamptz;

-- この SQL を実行した時点で 48 時間より前に入っていた予約は、確認済みにしておく
-- （古い予約が一度に「新しい予約」に並ばないように）
update public.reservations
set acknowledged_at = created_at
where acknowledged_at is null
  and created_at < now() - interval '48 hours';
