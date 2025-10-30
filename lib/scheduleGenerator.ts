import { supabaseAdmin } from './supabaseServer';

/**
 * Opcoes para geracao da escala.
 * ministry: se definido, re-gerar apenas este ministerio (nome exato).
 * preserveLocked: se true, mantem assignments com locked = true.
 * allowIncomplete: quando false (padrao), gera erro se houver lacunas.
 */
export interface GenerateOptions {
  ministry?: string;
  preserveLocked?: boolean;
  createdBy: string;
  allowIncomplete?: boolean;
}

interface Profile {
  user_id: string;
  name: string;
  family_id: string | null;
}

export interface GenerationWarning {
  celebrationId: string;
  celebrationStartsAt: string;
  ministryId: string | null;
  ministryName: string;
  roleId: string | null;
  roleName: string;
  reason: string;
}

export class IncompleteAvailabilityError extends Error {
  public readonly warnings: GenerationWarning[];
  public readonly code = 'INCOMPLETE_AVAILABILITY';

  constructor(message: string, warnings: GenerationWarning[]) {
    super(message);
    this.warnings = warnings;
  }
}

const BAND_MINISTRY_NAME = 'Bandas';
const DERIVED_MINISTRY_NAMES = ['Multimï¿½ï¿½dia', 'ï¿½?udio', 'Iluminaï¿½ï¿½Çœo'];

const buildAssignmentKey = (celebrationId: string, roleId: string) => `${celebrationId}::${roleId}`;

export async function generateSchedule(
  month: number,
  year: number,
  options: GenerateOptions
): Promise<{ scheduleRunId: string; assignments: any[]; warnings: GenerationWarning[] }> {
  const allowIncomplete = options.allowIncomplete ?? false;

  const { data: existingRun, error: runError } = await supabaseAdmin
    .from('schedule_runs')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();
  if (runError) throw runError;

  const scheduleRunIdExisting = existingRun?.id ?? null;

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const { data: celebrations, error: celErr } = await supabaseAdmin
    .from('celebrations')
    .select('*')
    .gte('starts_at', startDate.toISOString())
    .lte('starts_at', endDate.toISOString())
    .order('starts_at');
  if (celErr) throw celErr;

  const [
    { data: bands },
    { data: bandMembers },
    { data: profiles },
    { data: ministries },
    { data: roles },
    { data: memberMinistries }
  ] = await Promise.all([
    supabaseAdmin.from('bands').select('*').eq('active', true),
    supabaseAdmin.from('band_members').select('*'),
    supabaseAdmin.from('profiles').select('user_id, name, family_id'),
    supabaseAdmin.from('ministries').select('*'),
    supabaseAdmin.from('roles').select('*'),
    supabaseAdmin.from('member_ministries').select('*')
  ]);

  if (!bands || !bandMembers || !profiles || !ministries || !roles || !memberMinistries) {
    throw new Error('Erro ao carregar dados necessarios');
  }

  const { data: availabilities } = await supabaseAdmin.from('availabilities').select('*');

  let existingAssignments: Array<{
    member_id: string;
    celebration_id: string;
    role_id: string;
    ministry_id: string;
    locked: boolean;
  }> = [];
  if (scheduleRunIdExisting) {
    const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
      .from('assignments')
      .select('member_id, celebration_id, role_id, ministry_id, locked')
      .eq('schedule_run_id', scheduleRunIdExisting);
    if (assignmentsError) throw assignmentsError;
    existingAssignments = assignmentsData ?? [];
  }

  const assignmentCount: Record<string, number> = {};
  existingAssignments.forEach((assignment) => {
    assignmentCount[assignment.member_id] = (assignmentCount[assignment.member_id] || 0) + 1;
  });

  const lockedKeys = new Set<string>();
  existingAssignments
    .filter((assignment) => assignment.locked)
    .forEach((assignment) => lockedKeys.add(buildAssignmentKey(assignment.celebration_id, assignment.role_id)));

  const assignmentsToInsert: Array<{
    celebration_id: string;
    ministry_id: string;
    role_id: string;
    member_id: string;
    locked: boolean;
  }> = [];
  const warnings: GenerationWarning[] = [];

  const bandsList = bands ?? [];
  const bandMinistry = ministries.find((m) => m.name === BAND_MINISTRY_NAME) ?? null;
  const derivedMinistries = DERIVED_MINISTRY_NAMES.map((name) =>
    ministries.find((m) => m.name === name) ?? null
  ).filter((ministry): ministry is NonNullable<typeof ministry> => Boolean(ministry));

  let bandToggle = 0;

  for (const celebration of celebrations ?? []) {
    const celebrationAvailabilities = (availabilities || []).filter(
      (availability) => availability.celebration_id === celebration.id && availability.available
    );
    const bandFamilyIds: Set<string> = new Set();

    let selectedBand: { id: string } | null = null;
    if (!options.ministry || options.ministry === BAND_MINISTRY_NAME) {
      if (bandsList.length > 0) {
        selectedBand = bandsList[bandToggle % bandsList.length];
        bandToggle += 1;
      }
    }

    if (selectedBand && bandMinistry) {
      const bandRoles = bandMembers.filter((member) => member.band_id === selectedBand?.id);
      for (const bandRole of bandRoles) {
        const candidateProfile = profiles.find((profile) => profile.user_id === bandRole.member_id);
        if (!candidateProfile) continue;

        const roleRecord = roles.find(
          (role) => role.ministry_id === bandMinistry.id && role.name === bandRole.role_in_band
        );

        const assignmentKey = roleRecord
          ? buildAssignmentKey(celebration.id, roleRecord.id)
          : null;

        if (assignmentKey && lockedKeys.has(assignmentKey) && options.preserveLocked) {
          continue;
        }

        const isAvailable = celebrationAvailabilities.some(
          (availability) => availability.member_id === bandRole.member_id
        );

        if (!isAvailable) {
          warnings.push({
            celebrationId: celebration.id,
            celebrationStartsAt: celebration.starts_at,
            ministryId: bandMinistry.id,
            ministryName: bandMinistry.name,
            roleId: roleRecord?.id ?? null,
            roleName: bandRole.role_in_band,
            reason: 'Sem membro disponivel para o papel na banda'
          });
          continue;
        }

        if (roleRecord) {
          assignmentsToInsert.push({
            celebration_id: celebration.id,
            ministry_id: bandMinistry.id,
            role_id: roleRecord.id,
            member_id: bandRole.member_id,
            locked: false
          });
          assignmentCount[bandRole.member_id] = (assignmentCount[bandRole.member_id] || 0) + 1;
        }

        if (candidateProfile.family_id) {
          bandFamilyIds.add(candidateProfile.family_id);
        }
      }
    }

    for (const ministry of derivedMinistries) {
      if (options.ministry && options.ministry !== ministry.name && options.ministry !== BAND_MINISTRY_NAME) {
        continue;
      }

      const ministryRoles = roles.filter((role) => role.ministry_id === ministry.id);

      for (const role of ministryRoles) {
        const assignmentKey = buildAssignmentKey(celebration.id, role.id);
        if (lockedKeys.has(assignmentKey) && options.preserveLocked) {
          continue;
        }

        const candidateIds = memberMinistries
          .filter((memberMinistry) => memberMinistry.ministry_id === ministry.id)
          .map((memberMinistry) => memberMinistry.member_id);

        const availableCandidates = profiles.filter((profile) => {
          if (!candidateIds.includes(profile.user_id)) return false;
          return celebrationAvailabilities.some((availability) => availability.member_id === profile.user_id);
        });

        let selectedMember: Profile | undefined;
        const familyCandidates = availableCandidates.filter(
          (candidate) => candidate.family_id && bandFamilyIds.has(candidate.family_id as string)
        );

        if (familyCandidates.length > 0) {
          selectedMember = familyCandidates.reduce((previous, current) => {
            const previousCount = assignmentCount[previous.user_id] || 0;
            const currentCount = assignmentCount[current.user_id] || 0;
            return currentCount < previousCount ? current : previous;
          });
        } else if (availableCandidates.length > 0) {
          selectedMember = availableCandidates.reduce((previous, current) => {
            const previousCount = assignmentCount[previous.user_id] || 0;
            const currentCount = assignmentCount[current.user_id] || 0;
            return currentCount < previousCount ? current : previous;
          });
        }

        if (!selectedMember) {
          warnings.push({
            celebrationId: celebration.id,
            celebrationStartsAt: celebration.starts_at,
            ministryId: ministry.id,
            ministryName: ministry.name,
            roleId: role.id,
            roleName: role.name,
            reason: 'Nenhum membro disponivel'
          });
          continue;
        }

        assignmentsToInsert.push({
          celebration_id: celebration.id,
          ministry_id: ministry.id,
          role_id: role.id,
          member_id: selectedMember.user_id,
          locked: false
        });
        assignmentCount[selectedMember.user_id] = (assignmentCount[selectedMember.user_id] || 0) + 1;
      }
    }
  }

  if (!allowIncomplete && warnings.length > 0) {
    throw new IncompleteAvailabilityError(
      'Existem celebracoes sem disponibilidade registrada. Solicite aos membros que atualizem ou utilize a geracao forcada.',
      warnings
    );
  }

  let scheduleRunId = scheduleRunIdExisting;
  if (!scheduleRunId) {
    const { data: newRun, error: insertErr } = await supabaseAdmin
      .from('schedule_runs')
      .insert({ month, year, status: 'draft', created_by: options.createdBy })
      .select()
      .single();
    if (insertErr) throw insertErr;
    scheduleRunId = newRun?.id;
  }

  if (!scheduleRunId) {
    throw new Error('Nao foi possivel determinar o schedule_run_id');
  }

  if (!options.preserveLocked) {
    let deleteQuery = supabaseAdmin
      .from('assignments')
      .delete()
      .eq('schedule_run_id', scheduleRunId)
      .eq('locked', false);
    if (options.ministry) {
      const { data: ministry } = await supabaseAdmin
        .from('ministries')
        .select('id')
        .eq('name', options.ministry)
        .maybeSingle();
      if (ministry?.id) {
        deleteQuery = deleteQuery.eq('ministry_id', ministry.id);
      }
    }
    await deleteQuery;
  }

  if (assignmentsToInsert.length > 0) {
    const payload = assignmentsToInsert.map((assignment) => ({
      ...assignment,
      schedule_run_id: scheduleRunId
    }));
    await supabaseAdmin.from('assignments').insert(payload);
  }

  return { scheduleRunId, assignments: assignmentsToInsert, warnings };
}
