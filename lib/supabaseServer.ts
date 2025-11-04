import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from './env';

/**
 * Cliente privilegiado do Supabase (service role) utilizado apenas em rotas e
 * funcoes server-side. Mantem o algoritmo de assinatura JWT resolvido para
 * validar tokens emitidos pela instancia (assimetrico ou nao).
 */
export const supabaseAdmin = createClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

export const resolvedSigningConfig = {
  algorithm: serverEnv.SUPABASE_JWT_SIGNING_ALG,
  publicKey: serverEnv.SUPABASE_JWT_PUBLIC_KEY,
  secret: serverEnv.SUPABASE_JWT_SECRET
};

export const isAsymmetricJwt =
  resolvedSigningConfig.algorithm.startsWith('RS') &&
  Boolean(resolvedSigningConfig.publicKey);

export const isSymmetricJwt =
  resolvedSigningConfig.algorithm.startsWith('HS') &&
  Boolean(resolvedSigningConfig.secret);

if (resolvedSigningConfig.algorithm.startsWith('RS') && !resolvedSigningConfig.publicKey) {
  console.warn(
    '[security] JWT configurado para modo assincrono (RS*) porém SUPABASE_JWT_PUBLIC_KEY não está definido. Configure a chave pública para validação externa.'
  );
}

if (resolvedSigningConfig.algorithm.startsWith('HS') && !resolvedSigningConfig.secret) {
  console.warn(
    '[security] JWT configurado para modo simétrico (HS*) porém SUPABASE_JWT_SECRET não está definido. Tokens não poderão ser verificados localmente.'
  );
}
