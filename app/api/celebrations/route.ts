import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAdmin } from '../_utils/ensureAdmin';

/**
 * API para CRUD de celebracoes.
 * action: create | update | delete | bulkCreate | cleanupPast
 */
export async function POST(request: Request) {
  const { action, payload } = await request.json();
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  switch (action) {
    case 'create': {
      const { starts_at, location, notes } = payload ?? {};
      if (!starts_at || !location) {
        return NextResponse.json({ error: 'starts_at e location sao obrigatorios' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('celebrations')
        .insert({ starts_at, location, notes: notes ?? null })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ data });
    }

    case 'update': {
      const { id, starts_at, location, notes } = payload ?? {};
      if (!id) {
        return NextResponse.json({ error: 'ID obrigatorio para atualizar' }, { status: 400 });
      }
      const updatePayload: Record<string, unknown> = {};
      if (starts_at) updatePayload.starts_at = starts_at;
      if (location) updatePayload.location = location;
      if (notes !== undefined) updatePayload.notes = notes;
      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: 'Nenhum campo enviado para atualizar' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('celebrations')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ data });
    }

    case 'bulkCreate': {
      const items = Array.isArray(payload?.celebrations) ? payload.celebrations : [];
      if (!items.length) {
        return NextResponse.json({ error: 'Nenhuma celebracao informada' }, { status: 400 });
      }
      const sanitized = items
        .filter((item: any) => item?.starts_at && item?.location)
        .map((item: any) => ({
          starts_at: item.starts_at,
          location: item.location,
          notes: item.notes ?? null
        }));
      if (!sanitized.length) {
        return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin.from('celebrations').insert(sanitized).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ data });
    }

    case 'cleanupPast': {
      const before = typeof payload?.before === 'string' ? payload.before : new Date().toISOString();
      const { error } = await supabaseAdmin.from('celebrations').delete().lt('starts_at', before);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    case 'delete': {
      const { id } = payload ?? {};
      if (!id) {
        return NextResponse.json({ error: 'ID obrigatorio para deletar' }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from('celebrations').delete().eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Acao nao suportada' }, { status: 400 });
  }
}
