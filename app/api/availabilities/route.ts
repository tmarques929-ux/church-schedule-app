import { NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';

/**
 * Permite ao membro logado registrar ou atualizar sua disponibilidade
 * para uma celebração específica.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) ?? {};
  } catch {
    // mantém payload vazio e valida abaixo
  }

  const celebrationId =
    typeof payload.celebration_id === 'string' ? payload.celebration_id.trim() : '';
  const availableValue =
    typeof payload.available === 'boolean' ? payload.available : null;

  if (!celebrationId) {
    return NextResponse.json(
      { error: 'Informe o identificador da celebracao.' },
      { status: 400 }
    );
  }

  if (availableValue === null) {
    return NextResponse.json(
      { error: 'Informe o valor de disponibilidade (true ou false).' },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { error } = await supabase
    .from('availabilities')
    .upsert(
      {
        member_id: user.id,
        celebration_id: celebrationId,
        available: availableValue
      },
      { onConflict: 'member_id,celebration_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
