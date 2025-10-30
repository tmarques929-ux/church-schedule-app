import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@lib/supabaseServer';

async function ensureAdmin() {
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return { errorResponse: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };
  }
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    return { errorResponse: NextResponse.json({ error: error.message }, { status: 400 }) };
  }
  if (!profile || profile.role !== 'ADMIN') {
    return { errorResponse: NextResponse.json({ error: 'Apenas administradores podem acessar' }, { status: 403 }) };
  }
  return { supabase };
}

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const url = new URL(request.url);
  const rawTerm = url.searchParams.get('term')?.trim() ?? '';
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 50);

  if (rawTerm.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const sanitized = rawTerm.replace(/[%]/g, '').replace(/,/g, '');
  if (!sanitized) {
    return NextResponse.json({ results: [] });
  }
  const ilikeTerm = `%${sanitized}%`;

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, name, username, role')
    .or(`name.ilike.${ilikeTerm},username.ilike.${ilikeTerm}`)
    .order('name')
    .limit(limit);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 400 });
  }

  return NextResponse.json({ results: profiles ?? [] });
}

