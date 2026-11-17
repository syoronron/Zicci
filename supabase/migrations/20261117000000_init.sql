-- =====================================================================
-- Zicci 初期スキーマ
-- Supabase の「SQL Editor」にこのファイルの中身を貼り付けて実行します。
-- =====================================================================

-- 時間帯の重なりチェック（EXCLUDE 制約）に必要な拡張機能
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 店舗
-- ---------------------------------------------------------------------
create table public.stores (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  address              text,
  -- 応募者向け予約ページの URL に使う文字列（例: /r/shibuya-ekimae）
  public_slug          text not null unique
                         check (public_slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  -- 面接1回の長さ（分）。初期値30分
  interview_minutes    integer not null default 30
                         check (interview_minutes between 10 and 180),
  -- 出勤直後・退勤直前に面接を入れない時間（分）
  shift_buffer_minutes integer not null default 15
                         check (shift_buffer_minutes between 0 and 120),
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 面接NGの時間帯（繁忙時間・休憩時間）
-- weekday: 0=日曜 … 6=土曜。NULL なら毎日
-- ---------------------------------------------------------------------
create table public.store_blocks (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  weekday    smallint check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  kind       text not null check (kind in ('busy', 'break')),
  check (start_time < end_time)
);
create index on public.store_blocks (store_id);

-- ---------------------------------------------------------------------
-- シフト表画像のアップロード履歴（AI 読み取り結果もここに保存）
-- ---------------------------------------------------------------------
create table public.shift_uploads (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  image_path   text not null,
  period_start date not null,
  period_end   date not null,
  ai_raw_json  jsonb,
  created_at   timestamptz not null default now(),
  check (period_start <= period_end)
);
create index on public.shift_uploads (store_id);

-- ---------------------------------------------------------------------
-- 従業員
-- ---------------------------------------------------------------------
create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  is_interviewer boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (store_id, name)
);

-- ---------------------------------------------------------------------
-- 勤務（シフト）
-- 日をまたぐ勤務は 24:00 までとして登録する（面接は深夜に入れないため）
-- ---------------------------------------------------------------------
create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  source      text not null default 'manual' check (source in ('ai', 'manual')),
  upload_id   uuid references public.shift_uploads (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (start_time < end_time),
  -- 同じ人の勤務が同じ日に重なって登録されないようにする
  exclude using gist (
    employee_id with =,
    tsrange(date + start_time, date + end_time) with &&
  )
);
create index on public.shifts (store_id, date);

-- ---------------------------------------------------------------------
-- 面接枠
-- draft=下書き / published=公開中 / closed=受付終了
-- ---------------------------------------------------------------------
create table public.interview_slots (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  status     text not null default 'draft'
               check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  check (start_at < end_at),
  -- 同じ店舗で時間帯が少しでも重なる枠は作れない
  -- （面接時間を後から変えても重複が起きないようにするため）
  exclude using gist (
    store_id with =,
    tstzrange(start_at, end_at) with &&
  )
);

-- 面接枠ごとの「対応できる担当者」（1人でもいれば予約可能）
create table public.slot_interviewers (
  slot_id     uuid not null references public.interview_slots (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  primary key (slot_id, employee_id)
);
create index on public.slot_interviewers (employee_id);

-- ---------------------------------------------------------------------
-- 予約
-- slot_id を UNIQUE にすることで「1つの枠に予約は1件だけ」を
-- データベースが保証する（同時に押されても2件目は必ず失敗する）
-- ---------------------------------------------------------------------
create table public.reservations (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores (id) on delete cascade,
  slot_id        uuid not null unique
                   references public.interview_slots (id) on delete restrict,
  interviewer_id uuid references public.employees (id) on delete set null,
  applicant_name text not null check (length(trim(applicant_name)) > 0),
  phone          text,
  email          text,
  created_at     timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index on public.reservations (store_id);

-- ---------------------------------------------------------------------
-- セキュリティ（RLS）
-- すべてのテーブルで RLS を有効にし、ポリシーは作らない。
-- → ブラウザから直接データベースを読み書きすることはできず、
--   サーバー側（秘密鍵を持つ Next.js のサーバー処理）からのみ操作できる。
-- ログイン機能（P4）を作るときに、必要なポリシーを追加する。
-- ---------------------------------------------------------------------
alter table public.stores            enable row level security;
alter table public.store_blocks      enable row level security;
alter table public.shift_uploads     enable row level security;
alter table public.employees         enable row level security;
alter table public.shifts            enable row level security;
alter table public.interview_slots   enable row level security;
alter table public.slot_interviewers enable row level security;
alter table public.reservations      enable row level security;
