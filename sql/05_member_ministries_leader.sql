-- ------------------------------------------------------------------
-- 05_member_ministries_leader.sql
--
-- Adiciona a coluna is_leader na tabela member_ministries para
-- controlar lideranca de cada ministerio. Execute este script no
-- projeto Supabase antes de usar o recurso no painel.
-- ------------------------------------------------------------------

ALTER TABLE public.member_ministries
  ADD COLUMN IF NOT EXISTS is_leader boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS member_ministries_is_leader_idx
  ON public.member_ministries (ministry_id, is_leader);
