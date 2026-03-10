-- ========================================
-- 映像制作案件管理システム - スキーマ定義
-- ========================================

-- UUID拡張
create extension if not exists "uuid-ossp";

-- ----------------------------------------
-- 案件テーブル
-- ----------------------------------------
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  project_no text not null unique,          -- 案件No（自動採番: EK-000001 形式）
  company_name text not null,               -- 会社名
  project_name text not null,               -- 案件名
  description text,                         -- 制作概要
  production_staff text,                    -- 制作担当
  sales_staff text,                         -- 営業担当
  status text not null default '未着手'
    check (status in ('未着手', '撮影前', '編集中', '先方確認中', '校了')),
  priority text not null default 'should'
    check (priority in ('must', 'should', 'want')),
  budget numeric(12, 0),                    -- 制作予算（円）
  cost numeric(12, 0),                      -- 原価（円）
  estimated_hours numeric(6, 1),            -- 予測工数（h）
  actual_hours numeric(6, 1),               -- 実工数（h）
  planning_hours numeric(6, 1),             -- 企画工数（h）
  shooting_hours numeric(6, 1),             -- 撮影工数（h）
  editing_hours numeric(6, 1),              -- 編集工数（h）
  storyboard_date date,                     -- コンテ提出日
  schedule_date date,                       -- 香盤提出日
  shooting_date date,                       -- 撮影日
  first_draft_date date,                    -- 初稿提出日
  final_date date,                          -- 校了投稿日
  notes text,                               -- 備考
  deleted_at timestamptz,                   -- 論理削除日時
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------
-- 案件No 自動採番シーケンス
-- ----------------------------------------
create sequence if not exists project_no_seq start 1;

create or replace function generate_project_no()
returns text as $$
begin
  return 'EK-' || lpad(nextval('project_no_seq')::text, 6, '0');
end;
$$ language plpgsql;

-- INSERTトリガーで自動採番
create or replace function set_project_no()
returns trigger as $$
begin
  if new.project_no is null or new.project_no = '' then
    new.project_no := generate_project_no();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_project_no
  before insert on public.projects
  for each row execute function set_project_no();

-- ----------------------------------------
-- updated_at 自動更新トリガー
-- ----------------------------------------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

-- ----------------------------------------
-- 変更履歴テーブル
-- ----------------------------------------
create table if not exists public.project_history (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  change_type text not null check (change_type in ('create', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------
-- Row Level Security
-- ----------------------------------------
alter table public.projects enable row level security;
alter table public.project_history enable row level security;

-- ログイン済みユーザーはすべての案件を参照・操作可能
create policy "Authenticated users can view projects"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert projects"
  on public.projects for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update projects"
  on public.projects for update
  using (auth.role() = 'authenticated');

-- 物理削除はポリシーで禁止（論理削除のみ）
-- DELETEポリシーは付与しない

-- 変更履歴は参照のみ
create policy "Authenticated users can view history"
  on public.project_history for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert history"
  on public.project_history for insert
  with check (auth.role() = 'authenticated');

-- ----------------------------------------
-- インデックス
-- ----------------------------------------
create index if not exists idx_projects_status on public.projects(status) where deleted_at is null;
create index if not exists idx_projects_company on public.projects(company_name) where deleted_at is null;
create index if not exists idx_projects_created_at on public.projects(created_at desc) where deleted_at is null;
create index if not exists idx_project_history_project_id on public.project_history(project_id);
