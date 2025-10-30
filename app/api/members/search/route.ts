import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAdmin } from '../../_utils/ensureAdmin';

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const url = new URL(request.url);
  const term = url.searchParams.get('term')?.trim() ?? '';
  if (!term) {
    return NextResponse.json({ results: [] });
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, name, role')
    .ilike('name', `%${term}%`)
    .order('name')
    .limit(20);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 400 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const userIds = profiles.map((p) => p.user_id);
  const nowIso = new Date().toISOString();

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('assignments')
    .select(
      'member_id, celebration:celebrations(id, starts_at, location, notes), ministry:ministries(name), role:roles(name)'
    )
    .in('member_id', userIds)
    .gt('celebrations.starts_at', nowIso)
    .order('starts_at', { foreignTable: 'celebrations' });

  if (assignmentsError) {
    return NextResponse.json({ error: assignmentsError.message }, { status: 400 });
  }

  const assignmentsByMember = assignments?.reduce<Record<string, any[]>>((acc, assignment) => {
    if (!acc[assignment.member_id]) acc[assignment.member_id] = [];
    acc[assignment.member_id].push(assignment);
    return acc;
  }, {}) ?? {};

  const results = profiles.map((profile) => ({
    user_id: profile.user_id,
    name: profile.name,
    role: profile.role,
    assignments: (assignmentsByMember[profile.user_id] || []).map((assignment) => ({
      celebration: assignment.celebration,
      ministry: assignment.ministry,
      role: assignment.role
    }))
  }));

  return NextResponse.json({ results });
}
