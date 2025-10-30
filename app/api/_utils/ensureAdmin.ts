import { NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@lib/supabaseServer';

type EnsureErrorResponse = { errorResponse: NextResponse };

type EnsureAuthenticatedSuccess = {
  user: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.getUserById>> extends { data: { user: infer U } }
    ? U
    : any;
};

export async function ensureAuthenticated(): Promise<EnsureAuthenticatedSuccess | EnsureErrorResponse> {
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { errorResponse: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };
  }

  return { user };
}

export async function ensureAdmin(): Promise<EnsureAuthenticatedSuccess | EnsureErrorResponse> {
  const authResult = await ensureAuthenticated();
  if ('errorResponse' in authResult) {
    return authResult;
  }

  const { user } = authResult;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return { errorResponse: NextResponse.json({ error: profileError.message }, { status: 400 }) };
  }

  if (!profile || profile.role !== 'ADMIN') {
    return { errorResponse: NextResponse.json({ error: 'Apenas administradores podem acessar' }, { status: 403 }) };
  }

  return { user };
}
