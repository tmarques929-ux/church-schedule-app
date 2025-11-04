import { NextResponse } from 'next/server';
import { createEvents } from 'ics';
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

  const { data: assignmentRows } = await supabaseAdmin
    .from('assignments')
    .select('celebration_id, ministry_id, role_id, member_id, is_placeholder, placeholder_reason')
    .eq('schedule_run_id', id);

  let calendarPayload: { filename: string; content: string } | null = null;
  let notificationsDispatched = 0;

  if (assignmentRows && assignmentRows.length > 0) {
    const celebrationIds = Array.from(new Set(assignmentRows.map((row) => row.celebration_id)));
    const ministryIds = Array.from(new Set(assignmentRows.map((row) => row.ministry_id)));
    const roleIds = Array.from(new Set(assignmentRows.map((row) => row.role_id)));
    const memberIds = Array.from(
      new Set(assignmentRows.map((row) => row.member_id).filter((value): value is string => Boolean(value)))
    );

    const [{ data: celebrations }, { data: ministries }, { data: roles }, { data: members }] =
      await Promise.all([
        celebrationIds.length
          ? supabaseAdmin
              .from('celebrations')
              .select('id, starts_at, location, notes')
              .in('id', celebrationIds)
          : Promise.resolve({ data: [] }),
        ministryIds.length
          ? supabaseAdmin.from('ministries').select('id, name').in('id', ministryIds)
          : Promise.resolve({ data: [] }),
        roleIds.length
          ? supabaseAdmin.from('roles').select('id, name').in('id', roleIds)
          : Promise.resolve({ data: [] }),
        memberIds.length
          ? supabaseAdmin.from('profiles').select('user_id, name').in('user_id', memberIds)
          : Promise.resolve({ data: [] })
      ]);

    const celebrationsById = new Map((celebrations ?? []).map((item) => [item.id, item]));
    const ministriesById = new Map((ministries ?? []).map((item) => [item.id, item]));
    const rolesById = new Map((roles ?? []).map((item) => [item.id, item]));
    const membersById = new Map((members ?? []).map((item) => [item.user_id, item]));

    const events = assignmentRows
      .filter((assignment) => assignment.member_id && !assignment.is_placeholder)
      .map((assignment) => {
        const celebration = celebrationsById.get(assignment.celebration_id);
        const ministry = ministriesById.get(assignment.ministry_id);
        const role = rolesById.get(assignment.role_id);
        const member = membersById.get(assignment.member_id as string);
        if (!celebration || !ministry || !role || !member) {
          return null;
        }

        const startDate = new Date(celebration.starts_at);
        const durationHours = 2;
        const descriptionLines = [
          `Responsavel: ${member.name}`,
          celebration.location ? `Local: ${celebration.location}` : null,
          celebration.notes ? `Notas: ${celebration.notes}` : null
        ].filter(Boolean);

        return {
          start: [
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            startDate.getDate(),
            startDate.getHours(),
            startDate.getMinutes()
          ] as [number, number, number, number, number],
          duration: { hours: durationHours },
          title: `${ministry.name} - ${role.name}`,
          description: descriptionLines.join('\n'),
          location: celebration.location ?? '',
          uid: `${assignment.role_id}-${assignment.celebration_id}@church-schedule-app`
        };
      })
      .filter(Boolean) as Array<{
      start: [number, number, number, number, number];
      duration: { hours: number };
      title: string;
      description: string;
      location: string;
      uid: string;
    }>;

    if (events.length > 0) {
      const { error: icsError, value } = createEvents(events);
      if (!icsError && value) {
        calendarPayload = {
          filename: `escala-${data?.month ?? ''}-${data?.year ?? ''}.ics`,
          content: Buffer.from(value, 'utf8').toString('base64')
        };
      } else if (icsError) {
        console.error('Falha ao gerar arquivo ICS', icsError);
      }
    }

    if (memberIds.length > 0) {
      const { data: subscriptions } = await supabaseAdmin
        .from('notification_subscriptions')
        .select('*')
        .in('member_id', memberIds)
        .eq('active', true);

      if (subscriptions && subscriptions.length > 0) {
        await Promise.all(
          subscriptions.map((subscription) =>
            supabaseAdmin.functions
              .invoke('schedule-notification', {
                body: {
                  scheduleRunId: id,
                  memberId: subscription.member_id,
                  channel: subscription.channel,
                  address: subscription.address
                }
              })
              .catch((invokeError) =>
                console.error('Falha ao enviar notificacao de escala', invokeError)
              )
          )
        );
        notificationsDispatched = subscriptions.length;
      }
    }
  }

  return NextResponse.json({
    data,
    calendar: calendarPayload,
    notificationsDispatched
  });
}
