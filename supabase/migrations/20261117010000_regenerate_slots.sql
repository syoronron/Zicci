-- =====================================================================
-- 面接枠の作り直し（P1）
-- 初期スキーマのあとに、SQL Editor で実行してください。
-- =====================================================================

-- 指定期間の「予約が入っていない枠」を削除し、新しい枠を下書きとして作る。
-- 1つの関数（＝1つのトランザクション）で行うので、途中で失敗しても
-- 「削除だけされて枠が消えた」といった中途半端な状態にならない。
--
-- p_slots の形式:
--   [{"start_at": "...", "end_at": "...", "interviewer_ids": ["uuid", ...]}, ...]
--
-- 予約済みの枠と時間が重なる候補は作らずにスキップする。
-- 戻り値: 作成した枠の数
create or replace function public.regenerate_slots(
  p_store_id uuid,
  p_from     timestamptz,
  p_to       timestamptz,
  p_slots    jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  s        jsonb;
  v_start  timestamptz;
  v_end    timestamptz;
  v_slot   uuid;
  v_count  integer := 0;
begin
  delete from interview_slots sl
  where sl.store_id = p_store_id
    and sl.start_at >= p_from
    and sl.start_at <  p_to
    and not exists (select 1 from reservations r where r.slot_id = sl.id);

  for s in select value from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) loop
    v_start := (s ->> 'start_at')::timestamptz;
    v_end   := (s ->> 'end_at')::timestamptz;

    if v_start < p_from or v_start >= p_to then
      raise exception 'slot % is outside the range', v_start;
    end if;

    if exists (
      select 1 from interview_slots x
      where x.store_id = p_store_id
        and tstzrange(x.start_at, x.end_at) && tstzrange(v_start, v_end)
    ) then
      continue;
    end if;

    insert into interview_slots (store_id, start_at, end_at, status)
    values (p_store_id, v_start, v_end, 'draft')
    returning id into v_slot;

    -- 対応できる担当者（この店舗の面接担当者だけを受け付ける）
    insert into slot_interviewers (slot_id, employee_id)
    select v_slot, e.id
    from employees e
    where e.store_id = p_store_id
      and e.is_interviewer
      and e.id in (
        select value::uuid from jsonb_array_elements_text(s -> 'interviewer_ids')
      );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ブラウザ側（anon / authenticated）からは呼べないようにし、
-- サーバー（service_role）からだけ実行できるようにする
revoke all on function public.regenerate_slots(uuid, timestamptz, timestamptz, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.regenerate_slots(uuid, timestamptz, timestamptz, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.regenerate_slots(uuid, timestamptz, timestamptz, jsonb) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.regenerate_slots(uuid, timestamptz, timestamptz, jsonb) to service_role;
  end if;
end $$;
