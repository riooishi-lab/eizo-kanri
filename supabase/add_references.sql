-- ========================================
-- リファレンス管理 - テーブル追加
-- Supabase SQL エディタで実行してください
-- ========================================

-- ----------------------------------------
-- reference_folders：フォルダ管理
-- （video_references が FK 参照するため先に作成）
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
-- video_references：リファレンス本体
-- （'references' は PostgreSQL 予約語のため video_references を使用）
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

-- インデックス
create index if not exists idx_video_references_folder_id  on public.video_references(folder_id);
create index if not exists idx_video_references_created_at on public.video_references(created_at desc);
