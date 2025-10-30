import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAdmin } from '../../_utils/ensureAdmin';

/**
 * Publica uma escala (schedule_run). Espera no corpo um
 * `id` contendo o UUID do schedule_run a ser publicado.
 */
export async function POST(request: Request) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });
  }

  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const { data, error } = await supabaseAdmin
    .from('schedule_runs')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
