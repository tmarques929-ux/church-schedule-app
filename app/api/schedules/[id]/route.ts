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
  const celebrationId = url.searchParams.get('celebrationId');

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

  const filteredRows = celebrationId
    ? rows.filter((row) => row.celebrationId === celebrationId)
    : rows;

  if (celebrationId && filteredRows.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma atribuicao encontrada para esta celebracao.' },
      { status: 404 }
    );
  }

  if (format === 'csv') {
    const csv = stringify(filteredRows, {
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
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();
    const marginX = 50;
    const marginTop = 50;
    const marginBottom = 50;
    const lineHeight = 14;
    let y = height - marginTop;

    const ensureSpace = (linesNeeded = 1) => {
      if (y - linesNeeded * lineHeight < marginBottom) {
        page = pdfDoc.addPage();
        y = page.getSize().height - marginTop;
      }
    };

    const celebrationReferenceMap = new Map(
      (celebrations ?? []).map((item) => [item.id, item])
    );

    const celebrationGroupsMap = new Map<
      string,
      {
        id: string;
        title: string;
        date: string | null;
        location: string | null;
        ministries: Map<
          string,
          {
            id: string;
            name: string;
            assignments: { role: string; member: string }[];
          }
        >;
      }
    >();

    filteredRows.forEach((row) => {
      const celebrationRef = celebrationReferenceMap.get(row.celebrationId);
      const rawDate = celebrationRef?.starts_at ?? row.date;
      const formattedDate = rawDate
        ? new Date(rawDate).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : 'Data indefinida';
      const celebrationTitle =
        celebrationRef?.notes ?? celebrationRef?.title ?? `Celebracao ${formattedDate}`;

      const celebrationGroup =
        celebrationGroupsMap.get(row.celebrationId) ??
        celebrationGroupsMap
          .set(row.celebrationId, {
            id: row.celebrationId,
            title: celebrationTitle,
            date: rawDate ?? null,
            location: celebrationRef?.location ?? row.location ?? null,
            ministries: new Map()
          })
          .get(row.celebrationId)!;

      const ministryKey = row.ministryId ?? 'sem-ministerio';
      const ministryName = row.ministry ?? 'Ministerio nao definido';
      const ministryGroup =
        celebrationGroup.ministries.get(ministryKey) ??
        celebrationGroup.ministries
          .set(ministryKey, {
            id: ministryKey,
            name: ministryName,
            assignments: []
          })
          .get(ministryKey)!;

      ministryGroup.assignments.push({
        role: row.role ?? 'Funcao nao definida',
        member: row.member ?? 'Sem membro alocado'
      });
    });

    const celebrationGroups = Array.from(celebrationGroupsMap.values()).sort((a, b) => {
      if (!a.date || !b.date) return a.title.localeCompare(b.title);
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    ensureSpace(2);
    page.drawText(`Escala ${scheduleRun.month}/${scheduleRun.year}`, {
      x: marginX,
      y,
      size: 18,
      font: boldFont
    });
    y -= lineHeight * 2;

    if (celebrationGroups.length === 0) {
      ensureSpace(2);
      page.drawText('Nao existem atribuicoes para este filtro.', {
        x: marginX,
        y,
        size: 12,
        font: regularFont
      });
    }

    celebrationGroups.forEach((celebration, indexCelebration) => {
      const celebrationDate = celebration.date
        ? new Date(celebration.date).toLocaleString('pt-BR', {
            dateStyle: 'full',
            timeStyle: 'short'
          })
        : 'Data a definir';
      ensureSpace(4);
      page.drawText(celebration.title, {
        x: marginX,
        y,
        size: 14,
        font: boldFont
      });
      y -= lineHeight;

      page.drawText(celebrationDate, {
        x: marginX,
        y,
        size: 11,
        font: regularFont
      });
      y -= lineHeight;

      if (celebration.location) {
        ensureSpace(1);
        page.drawText(`Local: ${celebration.location}`, {
          x: marginX,
          y,
          size: 11,
          font: regularFont
        });
        y -= lineHeight;
      } else {
        ensureSpace(1);
        page.drawText('Local: Nao informado', {
          x: marginX,
          y,
          size: 11,
          font: regularFont
        });
        y -= lineHeight;
      }

      const ministries = Array.from(celebration.ministries.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      ministries.forEach((ministry, indexMinistry) => {
        ensureSpace(2);
        page.drawText(ministry.name, {
          x: marginX,
          y,
          size: 12,
          font: boldFont
        });
        y -= lineHeight;

        const assignments = ministry.assignments.slice().sort((a, b) =>
          a.role.localeCompare(b.role)
        );

        assignments.forEach((assignment) => {
          ensureSpace(1);
          page.drawText(`- ${assignment.role}: ${assignment.member}`, {
            x: marginX + 12,
            y,
            size: 10,
            font: regularFont
          });
          y -= lineHeight;
        });

        if (indexMinistry !== ministries.length - 1) {
          y -= lineHeight / 2;
        }
      });

      if (indexCelebration !== celebrationGroups.length - 1) {
        y -= lineHeight;
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
