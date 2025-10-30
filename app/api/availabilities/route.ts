import { NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';

/**
 * Permite ao membro logado registrar ou atualizar sua disponibilidade
 * para uma celebraÃ§Ã£o. O corpo deve conter `celebration_id` e
 * `available` (boolean). O uso de upsert garante que o registro
 * seja criado ou atualizado conforme o caso.
 */
export async function POST(request: Request) {
  const { celebration_id, available } = await request.json();
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'NÃ£o autenticado' }, { status: 401 });
  }
  const { error } = await supabase
    .from('availabilities')
    .upsert({ member_id: user.id, celebration_id, available }, { onConflict: 'member_id,celebration_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
