-- =====================================================================
-- 面接後の進み具合（マイルストーン）とアフターサービス
-- SQL Editor で実行してください（何回実行しても大丈夫です）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 店舗：結果連絡までの日数と、応募者に表示する文面
-- ---------------------------------------------------------------------
alter table public.stores
  add column if not exists result_days integer not null default 3,
  add column if not exists onboarding_message text not null default
    '初出勤の日は、開始時刻の10分前にお店へお越しください。スタッフに「新しく入る〇〇です」とお声がけください。'
    || E'\n' || '持ち物：黒い靴（スニーカー可）、筆記用具、給与振込先の口座がわかるもの',
  add column if not exists thanks_message text not null default
    'このたびはご応募いただき、また面接にお越しいただき、ありがとうございました。'
    || '慎重に検討しました結果、今回はご希望に添えない結果となりました。'
    || 'またご縁がありましたら、どうぞよろしくお願いいたします。';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_result_days_range') then
    alter table public.stores add constraint stores_result_days_range check (result_days between 1 and 14);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 予約：進み具合
--   booked      予約済み（面接前）
--   interviewed 面接済み・選考中
--   passed      採用
--   rejected    見送り
--   canceled    応募者が辞退（日時変更を含む）
-- ---------------------------------------------------------------------
alter table public.reservations
  add column if not exists status          text not null default 'booked',
  add column if not exists interview_at     timestamptz,
  add column if not exists interview_end_at timestamptz,
  add column if not exists result_due       date,
  add column if not exists first_day_at     timestamptz,
  add column if not exists status_token     uuid not null default gen_random_uuid(),
  add column if not exists canceled_reason  text,
  add column if not exists updated_at       timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_status_valid') then
    alter table public.reservations add constraint reservations_status_valid
      check (status in ('booked', 'interviewed', 'passed', 'rejected', 'canceled'));
  end if;
end $$;

-- 応募者専用ページの URL に使う（推測できないランダムな値）
create unique index if not exists reservations_status_token_key on public.reservations (status_token);

-- 面接の日時を予約にも記録する（辞退で枠を空けたあとも、いつの面接だったか分かるように）
update public.reservations r
set interview_at = s.start_at, interview_end_at = s.end_at
from public.interview_slots s
where r.slot_id = s.id and r.interview_at is null;

-- 辞退した予約は枠を手放す（slot_id を空にする）ので、空を許可する
alter table public.reservations alter column slot_id drop not null;

-- 新しい予約には、枠の日時を自動で記録する
create or replace function public.reservations_fill_interview_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slot_id is not null and (new.interview_at is null or new.interview_end_at is null) then
    select start_at, end_at into new.interview_at, new.interview_end_at
    from interview_slots where id = new.slot_id;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_fill_interview_time on public.reservations;
create trigger reservations_fill_interview_time
  before insert on public.reservations
  for each row execute function public.reservations_fill_interview_time();

alter table public.reservations alter column interview_at set not null;
alter table public.reservations alter column interview_end_at set not null;

create index if not exists reservations_store_interview_at_idx on public.reservations (store_id, interview_at);
