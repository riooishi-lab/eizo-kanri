-- ========================================
-- Google Calendar 連携 - テーブル追加
-- Supabase SQL エディタで実行してください
-- ========================================

-- ----------------------------------------
-- google_tokens：OAuthトークン保存
-- ----------------------------------------
create table if not exists public.google_tokens (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null unique references auth.users(id) on delete cascade,
  google_email  text,                         -- 連携したGoogleアカウントのメール
  access_token  text        not null,
  refresh_token text,                         -- 初回認証時のみ取得
  expires_at    timestamptz not null,         -- アクセストークンの有効期限
  scope         text,
  last_synced_at timestamptz,                 -- 最終同期日時
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_google_tokens_updated_at
  before update on public.google_tokens
  for each row execute function update_updated_at();

alter table public.google_tokens enable row level security;

-- 自分のトークンのみ参照・操作可能
create policy "Users can view own google_tokens"
  on public.google_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own google_tokens"
  on public.google_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own google_tokens"
  on public.google_tokens for update
  using (auth.uid() = user_id);

-- ----------------------------------------
-- work_logs：カレンダーから取得した作業ログ
-- ----------------------------------------
create table if not exists public.work_logs (
  id                uuid        primary key default uuid_generate_v4(),
  project_id        uuid        references public.projects(id) on delete set null,
  date              date        not null,
  work_type         text        not null,   -- 企画/撮影/編集/段取り/打合せ/その他
  hours             numeric(5, 1),          -- イベント継続時間（h）
  staff             text,                   -- 担当者（任意）
  google_event_id   text        unique,     -- 重複防止キー
  google_event_title text,                  -- 元のイベントタイトル
  notes             text,                   -- イベント本文
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_work_logs_updated_at
  before update on public.work_logs
  for each row execute function update_updated_at();

alter table public.work_logs enable row level security;

create policy "Authenticated users can view work_logs"
  on public.work_logs for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert work_logs"
  on public.work_logs for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update work_logs"
  on public.work_logs for update
  using (auth.role() = 'authenticated');

-- インデックス
create index if not exists idx_work_logs_project_id on public.work_logs(project_id);
create index if not exists idx_work_logs_date       on public.work_logs(date desc);
create index if not exists idx_work_logs_event_id   on public.work_logs(google_event_id);
