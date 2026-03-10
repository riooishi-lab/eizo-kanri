-- ========================================
-- project_tasks テーブル追加
-- Supabase SQL エディタで実行してください
-- ========================================

create table if not exists public.project_tasks (
  id            uuid        primary key default uuid_generate_v4(),
  project_id    uuid        not null references public.projects(id) on delete cascade,
  task_index    integer     not null,   -- テンプレート内の順番（1〜14）
  label         text        not null,   -- タスク名
  is_done       boolean     not null default false,
  done_at       timestamptz,            -- チェックを入れた日時
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, task_index)
);

-- updated_at 自動更新（既存の update_updated_at() 関数を再利用）
create trigger trg_project_tasks_updated_at
  before update on public.project_tasks
  for each row execute function update_updated_at();

-- RLS
alter table public.project_tasks enable row level security;

create policy "Authenticated users can view project_tasks"
  on public.project_tasks for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert project_tasks"
  on public.project_tasks for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update project_tasks"
  on public.project_tasks for update
  using (auth.role() = 'authenticated');

-- インデックス
create index if not exists idx_project_tasks_project_id
  on public.project_tasks(project_id);
