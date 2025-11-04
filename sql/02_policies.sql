-- ------------------------------------------------------------
-- 02_policies.sql
--
-- Habilita Row Level Security (RLS) em todas as tabelas
-- e define policies de acesso para usuários ADMIN e MEMBER.
-- As policies utilizam subconsultas na tabela `profiles` para
-- checar o papel (`role`) do usuário logado. A função
-- `auth.uid()` retorna o UUID do usuário autenticado.

-- Função de verificação do papel do usuário autenticado
-- (retorna true se for ADMIN)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'ADMIN'
  );
$$;

-- Função de verificação do papel do usuário autenticado
-- (retorna true se for MEMBER)
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'MEMBER'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_leader(_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.member_ministries mm
      ON mm.member_id = p.user_id
     AND mm.ministry_id = _ministry_id
     AND mm.is_leader = true
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'ADMIN'
        OR (p.role = 'LEADER' AND mm.member_id IS NOT NULL)
      )
  );
$$;

-- -----------------------------------------------------------------
-- Habilitar RLS nas tabelas e criar policies
-- -----------------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Seleção: membros podem ver seus próprios dados, admins veem tudo
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Inserção/atualização/deleção: apenas admin
CREATE POLICY profiles_admin_write ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- FAMILIES
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Leitura: todos logados podem ler
CREATE POLICY families_select_all ON public.families
  FOR SELECT USING (true);

-- Escrita: somente admin
CREATE POLICY families_admin_write ON public.families
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MINISTRIES
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ministries_select_all ON public.ministries FOR SELECT USING (true);
CREATE POLICY ministries_admin_write ON public.ministries FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- BANDS
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY bands_select_all ON public.bands FOR SELECT USING (true);
CREATE POLICY bands_admin_write ON public.bands FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- BAND_MEMBERS
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
-- Leitura: todos
CREATE POLICY band_members_select_all ON public.band_members FOR SELECT USING (true);
-- Escrita: admin
CREATE POLICY band_members_admin_write ON public.band_members FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MEMBER_MINISTRIES
ALTER TABLE public.member_ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_ministries_select_all ON public.member_ministries FOR SELECT USING (true);
CREATE POLICY member_ministries_admin_write ON public.member_ministries FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- CELEBRATIONS
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY celebrations_select_all ON public.celebrations FOR SELECT USING (true);
CREATE POLICY celebrations_admin_write ON public.celebrations FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- AVAILABILITIES
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

-- Leitura: admin vê tudo; membro vê apenas as suas
CREATE POLICY availabilities_select_admin ON public.availabilities FOR SELECT USING (public.is_admin());
CREATE POLICY availabilities_select_self ON public.availabilities FOR SELECT USING (member_id = auth.uid());

-- Inserção: membro pode inserir/atualizar a própria disponibilidade; admin pode tudo
CREATE POLICY availabilities_member_write ON public.availabilities
  FOR INSERT WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY availabilities_update_member ON public.availabilities
  FOR UPDATE USING ((member_id = auth.uid()) OR public.is_admin()) WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY availabilities_delete_admin ON public.availabilities
  FOR DELETE USING (public.is_admin());

-- ROLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select_all ON public.roles FOR SELECT USING (true);
CREATE POLICY roles_admin_write ON public.roles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SCHEDULE_RUNS
ALTER TABLE public.schedule_runs ENABLE ROW LEVEL SECURITY;
-- Leitura: admin vê tudo; membro vê somente escalas publicadas
CREATE POLICY schedule_runs_select_admin ON public.schedule_runs FOR SELECT USING (public.is_admin());
CREATE POLICY schedule_runs_select_member ON public.schedule_runs FOR SELECT USING (status = 'published');
CREATE POLICY schedule_runs_select_leader ON public.schedule_runs
  FOR SELECT
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.schedule_run_id = id
        AND public.is_leader(a.ministry_id)
    )
  );

-- Escrita: admin apenas
CREATE POLICY schedule_runs_admin_write ON public.schedule_runs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ASSIGNMENTS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Leitura: admin vê tudo; membro vê apenas suas atribuições em escalas publicadas
CREATE POLICY assignments_select_admin ON public.assignments FOR SELECT USING (public.is_admin());
CREATE POLICY assignments_select_member ON public.assignments FOR SELECT USING (
  member_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.schedule_runs sr WHERE sr.id = schedule_run_id AND sr.status = 'published'
  )
);
CREATE POLICY assignments_select_leader ON public.assignments
  FOR SELECT
  USING (public.is_admin() OR public.is_leader(ministry_id));

-- Escrita: somente admin
CREATE POLICY assignments_admin_write ON public.assignments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MEMBER_ROLE_PREFERENCES
ALTER TABLE public.member_role_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_role_preferences_select_admin ON public.member_role_preferences FOR SELECT USING (public.is_admin());
CREATE POLICY member_role_preferences_select_self ON public.member_role_preferences FOR SELECT USING (member_id = auth.uid());
CREATE POLICY member_role_preferences_insert_self ON public.member_role_preferences
  FOR INSERT WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY member_role_preferences_update_self ON public.member_role_preferences
  FOR UPDATE USING ((member_id = auth.uid()) OR public.is_admin()) WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY member_role_preferences_delete_admin ON public.member_role_preferences FOR DELETE USING (public.is_admin());

-- ASSIGNMENT_CONSTRAINTS
ALTER TABLE public.assignment_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignment_constraints_select_admin ON public.assignment_constraints FOR SELECT USING (public.is_admin());
CREATE POLICY assignment_constraints_admin_write ON public.assignment_constraints FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SCHEDULE_RUN_VERSIONS
ALTER TABLE public.schedule_run_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_run_versions_select_admin ON public.schedule_run_versions FOR SELECT USING (public.is_admin());
CREATE POLICY schedule_run_versions_admin_write ON public.schedule_run_versions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SCHEDULE_FEEDBACK
ALTER TABLE public.schedule_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_feedback_select_admin ON public.schedule_feedback FOR SELECT USING (public.is_admin());
CREATE POLICY schedule_feedback_select_self ON public.schedule_feedback FOR SELECT USING (submitted_by = auth.uid());
CREATE POLICY schedule_feedback_insert_self ON public.schedule_feedback
  FOR INSERT WITH CHECK ((submitted_by = auth.uid()) OR public.is_admin());
CREATE POLICY schedule_feedback_admin_update ON public.schedule_feedback
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY schedule_feedback_delete_admin ON public.schedule_feedback FOR DELETE USING (public.is_admin());

-- NOTIFICATION_SUBSCRIPTIONS
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_subscriptions_select_admin ON public.notification_subscriptions FOR SELECT USING (public.is_admin());
CREATE POLICY notification_subscriptions_select_self ON public.notification_subscriptions FOR SELECT USING (member_id = auth.uid());
CREATE POLICY notification_subscriptions_insert_self ON public.notification_subscriptions
  FOR INSERT WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY notification_subscriptions_update_self ON public.notification_subscriptions
  FOR UPDATE USING ((member_id = auth.uid()) OR public.is_admin()) WITH CHECK ((member_id = auth.uid()) OR public.is_admin());
CREATE POLICY notification_subscriptions_delete_self ON public.notification_subscriptions
  FOR DELETE USING ((member_id = auth.uid()) OR public.is_admin());

-- MEMBER_ASSIGNMENT_STATS
ALTER TABLE public.member_assignment_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_assignment_stats_select_admin ON public.member_assignment_stats FOR SELECT USING (public.is_admin());
CREATE POLICY member_assignment_stats_select_self ON public.member_assignment_stats FOR SELECT USING (member_id = auth.uid());
