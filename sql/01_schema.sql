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
  role text NOT NULL CHECK (role IN ('ADMIN', 'LEADER', 'MEMBER')),
  family_id uuid REFERENCES public.families (id) ON DELETE SET NULL,
  birth_date date,
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
  is_leader boolean NOT NULL DEFAULT false,
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
  member_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_reason text,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_run_id, celebration_id, role_id),
  CHECK (
    (is_placeholder AND member_id IS NULL)
    OR ((NOT is_placeholder) AND member_id IS NOT NULL)
  )
);

-- Índice para acelerar consultas de disponibilidade
CREATE INDEX IF NOT EXISTS idx_availabilities_member ON public.availabilities (member_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_celebration ON public.availabilities (celebration_id);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_unique_member_per_celebration
  ON public.assignments (schedule_run_id, celebration_id, member_id)
  WHERE member_id IS NOT NULL;

-- Preferências de membros por função/ministério
CREATE TABLE IF NOT EXISTS public.member_role_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  preference_type text NOT NULL CHECK (preference_type IN ('prefer', 'avoid', 'exclusive')),
  affinity_score int NOT NULL CHECK (affinity_score BETWEEN 0 AND 100),
  competency_level int CHECK (competency_level BETWEEN 0 AND 5),
  weight numeric(6,2) NOT NULL DEFAULT 1.0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, role_id, preference_type)
);

-- Restrições específicas por celebração/data
CREATE TABLE IF NOT EXISTS public.assignment_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celebration_id uuid NOT NULL REFERENCES public.celebrations (id) ON DELETE CASCADE,
  ministry_id uuid REFERENCES public.ministries (id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles (id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  family_id uuid REFERENCES public.families (id) ON DELETE CASCADE,
  constraint_type text NOT NULL CHECK (constraint_type IN ('exclude', 'prefer', 'require')),
  priority_level int NOT NULL DEFAULT 0,
  weight numeric(6,2),
  reason text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Histórico de versões geradas
CREATE TABLE IF NOT EXISTS public.schedule_run_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_run_id uuid NOT NULL REFERENCES public.schedule_runs (id) ON DELETE CASCADE,
  version_number int NOT NULL,
  generated_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  generation_parameters jsonb NOT NULL,
  objective_score numeric(12,4),
  warnings jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_run_id, version_number)
);

-- Feedback de líderes sobre distribuições
CREATE TABLE IF NOT EXISTS public.schedule_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_run_id uuid NOT NULL REFERENCES public.schedule_runs (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments (id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  category text CHECK (category IN ('availability', 'competency', 'preference', 'fairness', 'other')),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  comment text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Contatos para notificações automatizadas
CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  address text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, channel, address)
);

-- Estatisticas agregadas de atribuicoes por membro
CREATE TABLE IF NOT EXISTS public.member_assignment_stats (
  member_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  total_assignments int NOT NULL DEFAULT 0,
  assignments_last_30_days int NOT NULL DEFAULT 0,
  last_assigned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Funcoes utilitarias
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_member_assignment_stats(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_member_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.member_assignment_stats AS mas (
    member_id,
    total_assignments,
    assignments_last_30_days,
    last_assigned_at,
    updated_at
  )
  SELECT
    p_member_id,
    COALESCE(
      (SELECT COUNT(*) FROM public.assignments a WHERE a.member_id = p_member_id),
      0
    ),
    COALESCE(
      (
        SELECT COUNT(*)
        FROM public.assignments a
        JOIN public.celebrations c ON c.id = a.celebration_id
        WHERE a.member_id = p_member_id
          AND c.starts_at >= NOW() - INTERVAL '30 days'
      ),
      0
    ),
    (
      SELECT MAX(c.starts_at)
      FROM public.assignments a
      JOIN public.celebrations c ON c.id = a.celebration_id
      WHERE a.member_id = p_member_id
    ),
    NOW()
  ON CONFLICT (member_id)
  DO UPDATE
    SET total_assignments = EXCLUDED.total_assignments,
        assignments_last_30_days = EXCLUDED.assignments_last_30_days,
        last_assigned_at = EXCLUDED.last_assigned_at,
        updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_assignments_refresh_member_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.member_id IS NOT NULL THEN
      PERFORM public.refresh_member_assignment_stats(NEW.member_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.member_id IS NOT NULL THEN
      PERFORM public.refresh_member_assignment_stats(OLD.member_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.member_id IS NOT NULL THEN
      PERFORM public.refresh_member_assignment_stats(NEW.member_id);
    END IF;
    IF OLD.member_id IS NOT NULL AND OLD.member_id IS DISTINCT FROM NEW.member_id THEN
      PERFORM public.refresh_member_assignment_stats(OLD.member_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Visoes
CREATE OR REPLACE VIEW public.upcoming_celebration_assignments AS
SELECT
  c.id AS celebration_id,
  c.starts_at,
  c.location,
  c.notes,
  sr.id AS schedule_run_id,
  sr.status AS schedule_status,
  m.id AS ministry_id,
  m.name AS ministry_name,
  r.id AS role_id,
  r.name AS role_name,
  a.member_id,
  p.name AS member_name,
  a.is_placeholder,
  a.locked
FROM public.celebrations c
LEFT JOIN public.assignments a ON a.celebration_id = c.id AND a.is_placeholder = false
LEFT JOIN public.schedule_runs sr ON sr.id = a.schedule_run_id
LEFT JOIN public.ministries m ON m.id = a.ministry_id
LEFT JOIN public.roles r ON r.id = a.role_id
LEFT JOIN public.profiles p ON p.user_id = a.member_id
WHERE c.starts_at >= NOW()
ORDER BY c.starts_at ASC;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.member_assignment_load_mv
AS
SELECT
  p.user_id AS member_id,
  p.name AS member_name,
  COUNT(*) FILTER (WHERE a.member_id IS NOT NULL) AS total_assignments,
  COUNT(*) FILTER (
    WHERE a.member_id IS NOT NULL
      AND c.starts_at IS NOT NULL
      AND c.starts_at >= NOW() - INTERVAL '30 days'
  ) AS assignments_last_30_days,
  MAX(c.starts_at) AS last_assigned_at,
  NOW() AS generated_at
FROM public.profiles p
LEFT JOIN public.assignments a
  ON a.member_id = p.user_id
 AND a.is_placeholder = false
LEFT JOIN public.celebrations c
  ON c.id = a.celebration_id
GROUP BY p.user_id, p.name;

-- Triggers
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER availabilities_set_updated_at
BEFORE UPDATE ON public.availabilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER member_role_preferences_set_updated_at
BEFORE UPDATE ON public.member_role_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER schedule_feedback_set_updated_at
BEFORE UPDATE ON public.schedule_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER notification_subscriptions_set_updated_at
BEFORE UPDATE ON public.notification_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER assignments_refresh_member_stats
AFTER INSERT OR DELETE OR UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_assignments_refresh_member_stats();
