import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { stringify } from 'csv-stringify/sync';
import { ensureAuthenticated } from '../../_utils/ensureAdmin';

type Params = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: Params) {
  const { id } = params;
  const url = new URL(request.url);
  const format = url.searchParams.get('format');

  const authResult = await ensureAuthenticated();
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  const { user } = authResult;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'ADMIN';

  const { data: scheduleRun, error: scheduleError } = await supabaseAdmin
    .from('schedule_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (scheduleError || !scheduleRun) {
    return NextResponse.json({ error: 'Schedule nao encontrado' }, { status: 404 });
  }

  if (!isAdmin && scheduleRun.status !== 'published') {
    return NextResponse.json({ error: 'Escala ainda nao publicada' }, { status: 403 });
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('schedule_run_id', id);

  if (assignmentsError) {
    return NextResponse.json({ error: assignmentsError.message }, { status: 400 });
  }

  const celebrationIds = Array.from(
    new Set((assignments ?? []).map((assignment) => assignment.celebration_id))
  );

  const [{ data: celebrations }, { data: ministries }, { data: roles }, { data: profiles }] =
    await Promise.all([
      supabaseAdmin
        .from('celebrations')
        .select('*')
        .in('id', celebrationIds.length > 0 ? celebrationIds : ['00000000-0000-0000-0000-000000000000']),
      supabaseAdmin.from('ministries').select('*'),
      supabaseAdmin.from('roles').select('*'),
      supabaseAdmin.from('profiles').select('user_id, name')
    ]);

  const rows = (assignments ?? []).map((assignment: any) => {
    const celebration = celebrations?.find((item) => item.id === assignment.celebration_id);
    const ministry = ministries?.find((item) => item.id === assignment.ministry_id);
    const role = roles?.find((item) => item.id === assignment.role_id);
    const member = profiles?.find((item) => item.user_id === assignment.member_id);
    return {
      assignmentId: assignment.id,
      celebrationId: celebration?.id ?? assignment.celebration_id,
      date: celebration?.starts_at ?? null,
      location: celebration?.location ?? null,
      ministryId: ministry?.id ?? assignment.ministry_id,
      ministry: ministry?.name ?? null,
      roleId: role?.id ?? assignment.role_id,
      role: role?.name ?? null,
      memberId: member?.user_id ?? assignment.member_id,
      member: member?.name ?? null,
      locked: assignment.locked ?? false
    };
  });

  if (format === 'csv') {
    const csv = stringify(rows, {
      header: true,
      columns: ['date', 'ministry', 'role', 'member']
    });
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="schedule_${id}.csv"`
      }
    });
  }

  if (format === 'pdf') {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 750;
    page.drawText(`Escala ${scheduleRun.month}/${scheduleRun.year}`, { x: 50, y, size: 18, font });
    y -= 30;

    rows.forEach((row) => {
      const labelDate = row.date ? new Date(row.date).toLocaleString('pt-BR') : 'Data indefinida';
      page.drawText(`${labelDate} | ${row.ministry ?? ''} | ${row.role ?? ''} | ${row.member ?? ''}`, {
        x: 50,
        y,
        size: 10,
        font
      });
      y -= 16;
      if (y < 50) {
        y = 750;
        page = pdfDoc.addPage();
      }
    });

    const pdfBytes = await pdfDoc.save();
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="schedule_${id}.pdf"`
      }
    });
  }

  return NextResponse.json({
    scheduleRun,
    assignments: rows,
    references: {
      celebrations,
      ministries,
      roles,
      profiles
    }
  });
}
