-- ========================================
-- リファレンス詳細機能 - カラム追加 & タイムスタンプテーブル
-- Supabase SQL エディタで実行してください
-- ========================================

-- video_references に詳細カラムを追加
alter table public.video_references
  add column if not exists company_name text,
  add column if not exists prefecture   text,
  add column if not exists case_content text,
  add column if not exists is_pinned    boolean not null default false;

-- ----------------------------------------
-- reference_timestamps：タイムスタンプメモ
-- ----------------------------------------
create table if not exists public.reference_timestamps (
  id           uuid        primary key default gen_random_uuid(),
  reference_id uuid        not null references public.video_references(id) on delete cascade,
  time_seconds integer     not null,
  memo         text,
  created_at   timestamptz not null default now()
);

alter table public.reference_timestamps enable row level security;

create policy "Authenticated users can select reference_timestamps"
  on public.reference_timestamps for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert reference_timestamps"
  on public.reference_timestamps for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete reference_timestamps"
  on public.reference_timestamps for delete
  using (auth.role() = 'authenticated');

create index if not exists idx_reference_timestamps_reference_id
  on public.reference_timestamps(reference_id);
create index if not exists idx_reference_timestamps_time
  on public.reference_timestamps(reference_id, time_seconds);
