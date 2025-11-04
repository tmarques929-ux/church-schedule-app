import { z } from 'zod';

const baseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL valida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatoria'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY é obrigatoria'),
  SUPABASE_JWT_PUBLIC_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_JWT_SIGNING_ALG: z
    .enum(['RS256', 'HS256', 'HS384', 'HS512'])
    .optional()
    .default('RS256'),
  ENFORCE_ADMIN_MFA: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((value) => value === 'true'),
  DEFAULT_USER_PASSWORD: z
    .string()
    .min(8, 'DEFAULT_USER_PASSWORD deve possuir no mínimo 8 caracteres')
    .default('MudarSenha123'),
  DEFAULT_USER_EMAIL_DOMAIN: z
    .string()
    .min(1, 'DEFAULT_USER_EMAIL_DOMAIN é obrigatorio')
    .transform((value) => value.toLowerCase())
    .default('voluntarios.icctremembe.local'),
  TZ: z.string().default('America/Sao_Paulo')
});

const parsed = baseSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_PUBLIC_KEY: process.env.SUPABASE_JWT_PUBLIC_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_JWT_SIGNING_ALG: process.env.SUPABASE_JWT_SIGNING_ALG,
  ENFORCE_ADMIN_MFA: process.env.ENFORCE_ADMIN_MFA,
  DEFAULT_USER_PASSWORD: process.env.DEFAULT_USER_PASSWORD,
  DEFAULT_USER_EMAIL_DOMAIN: process.env.DEFAULT_USER_EMAIL_DOMAIN,
  TZ: process.env.TZ
});

if (!parsed.success) {
  const formatted = parsed.error.flatten();
  const details = Object.entries(formatted.fieldErrors)
    .map(([field, messages]) => `- ${field}: ${messages?.join(', ')}`)
    .join('\n');
  throw new Error(`Variaveis de ambiente invalidas:\n${details}`);
}

const env = parsed.data;

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_PUBLIC_KEY: env.SUPABASE_JWT_PUBLIC_KEY ?? null,
  SUPABASE_JWT_SECRET: env.SUPABASE_JWT_SECRET ?? null,
  SUPABASE_JWT_SIGNING_ALG: env.SUPABASE_JWT_SIGNING_ALG,
  DEFAULT_USER_PASSWORD: env.DEFAULT_USER_PASSWORD,
  DEFAULT_USER_EMAIL_DOMAIN: env.DEFAULT_USER_EMAIL_DOMAIN,
  TZ: env.TZ,
  ENFORCE_ADMIN_MFA: env.ENFORCE_ADMIN_MFA
};

export type ServerEnv = typeof serverEnv;
