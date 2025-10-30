import { NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ministries')
    .select('id, name, description, active')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ministries: (data ?? []).map((ministry) => ({
      id: ministry.id,
      name: ministry.name,
      description: ministry.description,
      active: ministry.active
    }))
  });
}
