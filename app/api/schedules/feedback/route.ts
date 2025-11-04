import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAuthenticated } from '../../_utils/ensureAdmin';

type CreateFeedbackPayload = {
  scheduleRunId: string;
  assignmentId?: string | null;
  category?: 'availability' | 'competency' | 'preference' | 'fairness' | 'other';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  comment: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scheduleRunId = url.searchParams.get('scheduleRunId');
  if (!scheduleRunId) {
    return NextResponse.json({ error: 'scheduleRunId obrigatorio' }, { status: 400 });
  }

  const authResult = await ensureAuthenticated();
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  const { data, error } = await supabaseAdmin
    .from('schedule_feedback')
    .select('*')
    .eq('schedule_run_id', scheduleRunId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ feedback: data ?? [] });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as CreateFeedbackPayload | null;
  if (!payload?.scheduleRunId || !payload.comment?.trim()) {
    return NextResponse.json({ error: 'Dados insuficientes para registrar feedback' }, { status: 400 });
  }

  const authResult = await ensureAuthenticated();
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  const { user } = authResult;

  const record = {
    schedule_run_id: payload.scheduleRunId,
    assignment_id: payload.assignmentId ?? null,
    submitted_by: user.id,
    category: payload.category ?? 'other',
    severity: payload.severity ?? 'medium',
    comment: payload.comment.trim()
  };

  const { data, error } = await supabaseAdmin
    .from('schedule_feedback')
    .insert(record)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ feedback: data }, { status: 201 });
}
