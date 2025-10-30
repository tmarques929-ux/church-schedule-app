-- ------------------------------------------------------------
-- 03_seeds.sql
--
-- Dados de exemplo para o aplicativo de escalas. Esses inserts
-- populam bandas, ministérios, papéis, famílias, membros e
-- celebrações com disponibilidades variadas. Os valores de
-- UUID são gerados automaticamente. Ajuste conforme necessário
-- para o seu ambiente.

-- FAMÍLIAS
INSERT INTO public.families (id, name)
VALUES
  (gen_random_uuid(), 'Família Souza')
ON CONFLICT (name) DO NOTHING;

-- MINISTÉRIOS PADRÃO
INSERT INTO public.ministries (id, name, description, active)
VALUES
  (gen_random_uuid(), 'Bandas', 'Ministério de bandas', true),
  (gen_random_uuid(), 'Multimídia', 'Projeção e slides', true),
  (gen_random_uuid(), 'Áudio', 'Operação de som', true),
  (gen_random_uuid(), 'Iluminação', 'Luz cênica', true)
ON CONFLICT (name) DO NOTHING;

-- ROLES PARA CADA MINISTÉRIO
-- Bandas
INSERT INTO public.roles (id, ministry_id, name)
SELECT gen_random_uuid(), m.id, r
FROM public.ministries m, unnest(array['Vocal','Guitarra','Baixo','Bateria','Teclado']) r
WHERE m.name = 'Bandas';

-- Multimídia
INSERT INTO public.roles (id, ministry_id, name)
SELECT gen_random_uuid(), m.id, r
FROM public.ministries m, unnest(array['Projeção']) r
WHERE m.name = 'Multimídia';

-- Áudio
INSERT INTO public.roles (id, ministry_id, name)
SELECT gen_random_uuid(), m.id, r
FROM public.ministries m, unnest(array['Operador de Áudio']) r
WHERE m.name = 'Áudio';

-- Iluminação
INSERT INTO public.roles (id, ministry_id, name)
SELECT gen_random_uuid(), m.id, r
FROM public.ministries m, unnest(array['Light Op']) r
WHERE m.name = 'Iluminação';

-- BANDAS INICIAIS
INSERT INTO public.bands (id, name, description, active)
VALUES
  (gen_random_uuid(), 'Banda A', 'Banda principal', true),
  (gen_random_uuid(), 'Banda B', 'Banda de apoio', true)
ON CONFLICT (name) DO NOTHING;

-- PERFIS DE DEMONSTRAÇÃO (substitua os user_id pelos IDs reais do Supabase)
-- Para fins de demonstração, criamos quatro perfis e vinculamos à família Souza.
-- OBS: estas linhas podem falhar se o user_id não existir em auth.users; ajuste conforme necessário.

WITH fam AS (
  SELECT id FROM public.families WHERE name = 'Família Souza' LIMIT 1
),
admins AS (
  SELECT gen_random_uuid() AS user_id, 'Admin' AS name, 'ADMIN' AS role
),
members AS (
  SELECT gen_random_uuid() AS user_id, 'Ana' AS name, 'MEMBER' AS role UNION ALL
  SELECT gen_random_uuid(), 'João', 'MEMBER' UNION ALL
  SELECT gen_random_uuid(), 'Carla', 'MEMBER'
)
INSERT INTO public.profiles (user_id, name, role, family_id)
SELECT u.user_id, u.name, u.role, fam.id
FROM (
  SELECT * FROM admins
  UNION ALL
  SELECT * FROM members
) u, fam
ON CONFLICT (user_id) DO NOTHING;

-- RELACIONAMENTO MEMBRO → MINISTÉRIO
-- Vincula Ana à Banda (Bandas), João ao Áudio, Carla à Iluminação, Admin a todos

INSERT INTO public.member_ministries (member_id, ministry_id)
SELECT p.user_id, m.id
FROM public.profiles p
JOIN public.ministries m ON (
  (p.name = 'Ana' AND m.name = 'Bandas') OR
  (p.name = 'João' AND m.name = 'Áudio') OR
  (p.name = 'Carla' AND m.name = 'Iluminação') OR
  (p.name = 'Admin' AND m.name IN ('Bandas','Multimídia','Áudio','Iluminação'))
);

-- MEMBROS EM BANDAS (somente para Bandas A por enquanto)
INSERT INTO public.band_members (band_id, member_id, role_in_band)
SELECT b.id, p.user_id, 'Vocal'
FROM public.bands b, public.profiles p
WHERE b.name = 'Banda A' AND p.name = 'Ana'
ON CONFLICT (band_id, member_id) DO NOTHING;

INSERT INTO public.band_members (band_id, member_id, role_in_band)
SELECT b.id, p.user_id, 'Baixo'
FROM public.bands b, public.profiles p
WHERE b.name = 'Banda A' AND p.name = 'João'
ON CONFLICT (band_id, member_id) DO NOTHING;

-- CELEBRAÇÕES NO PRÓXIMO MÊS (substitua as datas conforme necessidade)
INSERT INTO public.celebrations (id, starts_at, location, notes)
VALUES
  (gen_random_uuid(), '2025-11-02T19:00:00-03:00', 'Igreja Central', 'Culto de Domingo'),
  (gen_random_uuid(), '2025-11-09T19:00:00-03:00', 'Igreja Central', 'Culto de Domingo'),
  (gen_random_uuid(), '2025-11-16T19:00:00-03:00', 'Igreja Central', 'Culto de Domingo'),
  (gen_random_uuid(), '2025-11-23T19:00:00-03:00', 'Igreja Central', 'Culto de Domingo'),
  (gen_random_uuid(), '2025-11-30T19:00:00-03:00', 'Igreja Central', 'Culto de Domingo'),
  (gen_random_uuid(), '2025-11-06T20:00:00-03:00', 'Igreja Central', 'Celebração Especial')
ON CONFLICT DO NOTHING;

-- DISPONIBILIDADES ALEATÓRIAS PARA OS MEMBROS
INSERT INTO public.availabilities (member_id, celebration_id, available)
SELECT p.user_id, c.id, (random() > 0.3)
FROM public.profiles p
CROSS JOIN public.celebrations c
ON CONFLICT (member_id, celebration_id) DO NOTHING;