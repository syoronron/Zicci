-- =====================================================================
-- 予約の作成（P2）
-- SQL Editor で実行してください（何回実行しても大丈夫です）。
-- =====================================================================

-- 応募者の予約を1件作る。
-- 1つの関数（＝1つのトランザクション）の中で、枠をロックしてから確認・登録するので、
-- 同じ枠に同時に申し込みがあっても、成功するのは必ず1件だけになる。
--
-- エラーは次のメッセージで返す（アプリ側で日本語の案内に変える）:
--   store_not_found  店舗が見つからない
--   slot_unavailable 公開中の枠ではない／対応できる担当者がいない
--   slot_too_soon    開始時刻が近すぎる
--   slot_taken       すでに予約が入っている
create or replace function public.create_reservation(
  p_store_slug text,
  p_slot_id    uuid,
  p_name       text,
  p_phone      text,
  p_email      text,
  p_min_lead   interval default interval '60 minutes'
) returns table (reservation_id uuid, slot_start_at timestamptz, slot_end_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_store_id    uuid;
  v_slot        interview_slots%rowtype;
  v_day         date;
  v_interviewer uuid;
  v_id          uuid;
begin
  select id into v_store_id from stores where public_slug = p_store_slug;
  if v_store_id is null then
    raise exception 'store_not_found';
  end if;

  -- 枠をロックする（同じ枠への同時申し込みは、ここで順番待ちになる）
  select * into v_slot
  from interview_slots
  where id = p_slot_id and store_id = v_store_id
  for update;

  if not found or v_slot.status <> 'published' then
    raise exception 'slot_unavailable';
  end if;
  if v_slot.start_at < now() + p_min_lead then
    raise exception 'slot_too_soon';
  end if;
  if exists (select 1 from reservations where slot_id = p_slot_id) then
    raise exception 'slot_taken';
  end if;

  -- 担当者：対応できる人のうち、その日（日本時間）の予約が少ない人
  v_day := (v_slot.start_at at time zone 'Asia/Tokyo')::date;
  select si.employee_id into v_interviewer
  from slot_interviewers si
  join employees e on e.id = si.employee_id and e.is_interviewer
  left join reservations r
    on r.interviewer_id = si.employee_id
   and r.slot_id in (
     select s2.id from interview_slots s2
     where s2.store_id = v_store_id
       and (s2.start_at at time zone 'Asia/Tokyo')::date = v_day
   )
  where si.slot_id = p_slot_id
  group by si.employee_id
  order by count(r.id), random()
  limit 1;

  if v_interviewer is null then
    raise exception 'slot_unavailable';
  end if;

  insert into reservations (store_id, slot_id, interviewer_id, applicant_name, phone, email)
  values (v_store_id, p_slot_id, v_interviewer, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_email), ''))
  returning id into v_id;

  return query select v_id, v_slot.start_at, v_slot.end_at;
exception
  when unique_violation then
    raise exception 'slot_taken';
end;
$$;

-- サーバー（service_role）からだけ実行できるようにする
revoke all on function public.create_reservation(text, uuid, text, text, text, interval) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_reservation(text, uuid, text, text, text, interval) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.create_reservation(text, uuid, text, text, text, interval) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_reservation(text, uuid, text, text, text, interval) to service_role;
  end if;
end $$;
