-- ------------------------------------------------------------------
-- 04_profiles_username.sql
--
-- Migracao para adicionar usernames unicos aos perfis.
-- Execute este script no editor SQL do Supabase (ou psql) para
-- habilitar o login por username implementado no app.
-- ------------------------------------------------------------------

-- 1) Adiciona a coluna caso ainda nao exista.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- 2) Gera usernames iniciais para qualquer perfil que esteja sem valor.
--    Substitui espacos por ponto, remove caracteres especiais e usa
--    letras minusculas para padronizar.
UPDATE public.profiles
SET username = lower(
      regexp_replace(
        regexp_replace(name, '\s+', '.', 'g'),
        '[^a-z0-9._-]',
        '',
        'g'
      )
    )
WHERE username IS NULL;

-- 3) Garante que nenhum registro fique com username vazio.
UPDATE public.profiles
SET username = concat('voluntario_', left(user_id::text, 8))
WHERE username IS NULL OR username = '';

-- 4) Resolve possiveis duplicatas geradas nos passos anteriores
--    acrescentando um sufixo incremental (_2, _3, ...).
WITH duplicatas AS (
  SELECT
    user_id,
    username,
    row_number() OVER (PARTITION BY username ORDER BY user_id) AS ordem
  FROM public.profiles
),
ajustes AS (
  SELECT
    d.user_id,
    CASE
      WHEN d.ordem = 1 THEN d.username
      ELSE concat(d.username, '_', d.ordem)
    END AS username_ajustado
  FROM duplicatas d
)
UPDATE public.profiles p
SET username = ajustes.username_ajustado
FROM ajustes
WHERE ajustes.user_id = p.user_id
  AND ajustes.username_ajustado IS NOT NULL
  AND p.username IS DISTINCT FROM ajustes.username_ajustado;

-- 5) Define a coluna como obrigatoria e garante exclusividade.
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END
$$;

-- 6) Ajusta o username do administrador principal (Thiago).
UPDATE public.profiles
SET username = 'thiagomrib'
WHERE user_id = 'ad3ec419-20af-49ca-ad01-79277c71a9c0';

