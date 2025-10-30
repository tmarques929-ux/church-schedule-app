-- ------------------------------------------------------------
-- 01_schema.sql
--
-- Este script cria a estrutura de tabelas utilizada pelo
-- aplicativo de escalas da igreja. As colunas usam UUIDs
-- gerados com a extensão pgcrypto. Caso ainda não esteja
-- habilitada no seu banco, ative com:
--   CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- PERFIS DOS USUÁRIOS (ligado ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
  family_id uuid REFERENCES public.families (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- MINISTÉRIOS
CREATE TABLE IF NOT EXISTS public.ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- BANDAS
CREATE TABLE IF NOT EXISTS public.bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- MEMBROS DE BANDA
CREATE TABLE IF NOT EXISTS public.band_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  role_in_band text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (band_id, member_id)
);

-- MEMBRO ⇄ MINISTÉRIO (relacionamento N:N)
CREATE TABLE IF NOT EXISTS public.member_ministries (
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, ministry_id)
);

-- CELEBRAÇÕES
CREATE TABLE IF NOT EXISTS public.celebrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  location text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- DISPONIBILIDADES DOS MEMBROS POR CELEBRAÇÃO
CREATE TABLE IF NOT EXISTS public.availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  celebration_id uuid NOT NULL REFERENCES public.celebrations (id) ON DELETE CASCADE,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, celebration_id)
);

-- ROLES (funções dentro de cada ministério)
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (ministry_id, name)
);

-- EXECUÇÃO DE ESCALAS (uma por mês)
CREATE TABLE IF NOT EXISTS public.schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  year int NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_at timestamptz
);

-- ASSIGNAÇÕES PARA CADA CELEBRAÇÃO E ROLE
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_run_id uuid NOT NULL REFERENCES public.schedule_runs (id) ON DELETE CASCADE,
  celebration_id uuid NOT NULL REFERENCES public.celebrations (id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_run_id, celebration_id, role_id),
  CONSTRAINT assignments_unique_member_per_celebration UNIQUE (schedule_run_id, celebration_id, member_id)
);

-- Índice para acelerar consultas de disponibilidade
CREATE INDEX IF NOT EXISTS idx_availabilities_member ON public.availabilities (member_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_celebration ON public.availabilities (celebration_id);
