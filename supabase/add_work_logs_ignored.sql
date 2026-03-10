-- work_logs に ignored カラムを追加
alter table public.work_logs
  add column if not exists ignored boolean not null default false;

-- ignored=true のログは未マッチ一覧から除外するためのインデックス
create index if not exists work_logs_unmatched_idx
  on public.work_logs (user_id, project_id, ignored)
  where project_id is null and ignored = false;
