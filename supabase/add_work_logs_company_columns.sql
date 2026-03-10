-- ========================================
-- work_logs に企業名・案件名カラムを追加
-- Supabase SQL エディタで実行してください
-- ========================================

alter table public.work_logs
  add column if not exists company_name text,
  add column if not exists project_name text;
