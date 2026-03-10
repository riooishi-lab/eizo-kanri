-- ========================================
-- references → video_references にリネーム
-- 'references' は PostgreSQL 予約語のため PostgREST が公開できない問題を修正
-- ========================================

-- 既存テーブルを削除（データがある場合は DROP → CREATE でリセット）
drop table if exists public.references cascade;
drop table if exists public.reference_folders cascade;

-- ----------------------------------------
-- reference_folders（名前はそのまま）
-- ----------------------------------------
create table if not exists public.reference_folders (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  color      text        not null default '#6366F1',
  created_at timestamptz not null default now()
);

alter table public.reference_folders enable row level security;

create policy "Authenticated users can select reference_folders"
  on public.reference_folders for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert reference_folders"
  on public.reference_folders for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update reference_folders"
  on public.reference_folders for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete reference_folders"
  on public.reference_folders for delete
  using (auth.role() = 'authenticated');

-- ----------------------------------------
-- video_references（予約語を避けた名前）
-- ----------------------------------------
create table if not exists public.video_references (
  id            uuid        primary key default gen_random_uuid(),
  url           text        not null,
  title         text,
  description   text,
  thumbnail_url text,
  orientation   text        not null default 'landscape'
                            check (orientation in ('landscape', 'portrait')),
  folder_id     uuid        references public.reference_folders(id) on delete set null,
  tags          text[]      not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.video_references enable row level security;

create policy "Authenticated users can select video_references"
  on public.video_references for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert video_references"
  on public.video_references for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update video_references"
  on public.video_references for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete video_references"
  on public.video_references for delete
  using (auth.role() = 'authenticated');

create index if not exists idx_video_references_folder_id  on public.video_references(folder_id);
create index if not exists idx_video_references_created_at on public.video_references(created_at desc);
