import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase URL e service role key devem estar configurados');
}

/**
 * Instância de client para uso no lado do servidor. Utiliza a chave de
 * service role do Supabase para contornar RLS em operações que
 * demandam permissões elevadas (por exemplo, geração de escala). **Não
 * exponha esta chave ao cliente.**
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});