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

interface Band {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean | null;
}

interface BandMember {
  band_id: string;
  member_id: string;
  role_in_band: string;
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

export class ExistingScheduleError extends Error {
  public readonly code = 'SCHEDULE_ALREADY_EXISTS';

  constructor(month: number, year: number) {
    const label = `${String(month).padStart(2, '0')}/${year}`;
    super(`Ja existe uma escala registrada para ${label}. Apague a versao atual antes de gerar novamente.`);
  }
}

const BAND_MINISTRY_NAME = 'Bandas';
const DERIVED_MINISTRY_NAMES = ['multimidia', 'audio', 'iluminacao'];
const SPECIAL_ELEVE_KEYWORDS = ['eleve', '30 semanas', '30-semanas', '30semana'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  if (existingRun) {
    throw new ExistingScheduleError(month, year);
  }

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
    { data: profiles },
    { data: ministries },
    { data: roles },
    { data: memberMinistries },
    { data: bands },
    { data: bandMembers }
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, name, family_id'),
    supabaseAdmin.from('ministries').select('*'),
    supabaseAdmin.from('roles').select('*'),
    supabaseAdmin.from('member_ministries').select('*'),
    supabaseAdmin.from('bands').select('*').eq('active', true),
    supabaseAdmin.from('band_members').select('*')
  ]);

  if (!profiles || !ministries || !roles || !memberMinistries || !bands || !bandMembers) {
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

  const normalizeName = (value: string | null | undefined) =>
    value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

  const profilesById = new Map<string, Profile>(
    profiles.map((profile) => [profile.user_id, profile] as [string, Profile])
  );

  const bandList: Band[] = ((bands as Band[] | null | undefined) ?? []).filter(
    (band) => band.active !== false
  );
  const bandMemberList: BandMember[] = (bandMembers as BandMember[] | null | undefined) ?? [];

  const normalizedBandName = normalizeName(BAND_MINISTRY_NAME);
  const bandMinistry =
    ministries.find((ministry) => normalizeName(ministry.name) === normalizedBandName) ?? null;
  const derivedMinistries = ministries.filter((ministry) =>
    DERIVED_MINISTRY_NAMES.includes(normalizeName(ministry.name))
  );
  const normalizedTargetMinistry = options.ministry ? normalizeName(options.ministry) : null;

  const sortedBands = [...bandList].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  );
  const eleveBand = sortedBands.find((band) => normalizeName(band.name).includes('eleve')) ?? null;
  const rotationBands = sortedBands.filter((band) => band.id !== eleveBand?.id);
  const primaryRotationBands = rotationBands.length > 0 ? rotationBands : sortedBands;
  const bandMapById = new Map(sortedBands.map((band) => [band.id, band]));

  const celebrationsList = celebrations ?? [];
  const sortedCelebrations = [...celebrationsList].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const firstSundayUtc = new Date(Date.UTC(year, month - 1, 1));
  while (firstSundayUtc.getUTCDay() !== 0) {
    firstSundayUtc.setUTCDate(firstSundayUtc.getUTCDate() + 1);
  }
  const firstSundayStartMs = Date.UTC(
    firstSundayUtc.getUTCFullYear(),
    firstSundayUtc.getUTCMonth(),
    firstSundayUtc.getUTCDate()
  );

  const celebrationBandMap = new Map<string, string | null>();
  sortedCelebrations.forEach((celebration) => {
    const date = new Date(celebration.starts_at);
    const dayStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

    const normalizedNotes = normalizeName((celebration as any).notes);
    const normalizedLocation = normalizeName((celebration as any).location);
    const isEleve = SPECIAL_ELEVE_KEYWORDS.some(
      (keyword) => normalizedNotes.includes(keyword) || normalizedLocation.includes(keyword)
    );

    if (isEleve && eleveBand) {
      celebrationBandMap.set(celebration.id, eleveBand.id);
      return;
    }

    let diffDays = Math.floor((dayStartMs - firstSundayStartMs) / MS_PER_DAY);
    if (diffDays < 0) diffDays = 0;
    const weekIndex = Math.floor(diffDays / 7);

    const rotationList = primaryRotationBands.length > 0 ? primaryRotationBands : sortedBands;
    const band =
      rotationList.length > 0 ? rotationList[weekIndex % rotationList.length] : eleveBand ?? null;

    celebrationBandMap.set(celebration.id, band?.id ?? null);
  });

  for (const celebration of celebrationsList) {
    const celebrationAvailabilities = (availabilities || []).filter(
      (availability) => availability.celebration_id === celebration.id
    );
    const availabilityMap = new Map<string, boolean>(
      celebrationAvailabilities.map((availability) => [availability.member_id, availability.available])
    );
    const bandFamilyIds: Set<string> = new Set();

    const shouldProcessBand =
      !normalizedTargetMinistry || normalizedTargetMinistry === normalizedBandName;
    if (shouldProcessBand && bandMinistry) {
      const selectedBandId = celebrationBandMap.get(celebration.id);
      const selectedBand = selectedBandId ? bandMapById.get(selectedBandId) ?? null : null;

      if (selectedBand) {
        const bandRoles = bandMemberList.filter((member) => member.band_id === selectedBand.id);

        if (bandRoles.length === 0) {
          warnings.push({
            celebrationId: celebration.id,
            celebrationStartsAt: celebration.starts_at,
            ministryId: bandMinistry.id,
            ministryName: bandMinistry.name,
            roleId: null,
            roleName: 'Banda',
            reason: 'Banda sem membros configurados'
          });
        }

        for (const bandRole of bandRoles) {
          const candidateProfile = profilesById.get(bandRole.member_id);
          if (!candidateProfile) {
            continue;
          }

           const availability = availabilityMap.get(bandRole.member_id);
           if (availability !== true) {
            warnings.push({
              celebrationId: celebration.id,
              celebrationStartsAt: celebration.starts_at,
              ministryId: bandMinistry.id,
              ministryName: bandMinistry.name,
              roleId: null,
              roleName: bandRole.role_in_band,
              reason:
                availability === false
                  ? 'Membro da banda marcou indisponivel'
                  : 'Membro da banda sem confirmacao de disponibilidade'
            });
            continue;
          }

          const roleRecord = roles.find(
            (role) => role.ministry_id === bandMinistry.id && role.name === bandRole.role_in_band
          );

          if (!roleRecord) {
            warnings.push({
              celebrationId: celebration.id,
              celebrationStartsAt: celebration.starts_at,
              ministryId: bandMinistry.id,
              ministryName: bandMinistry.name,
              roleId: null,
              roleName: bandRole.role_in_band,
              reason: 'Papel da banda nao encontrado na tabela de roles'
            });
            continue;
          }

          const assignmentKey = buildAssignmentKey(celebration.id, roleRecord.id);
          if (lockedKeys.has(assignmentKey) && options.preserveLocked) {
            continue;
          }

          assignmentsToInsert.push({
            celebration_id: celebration.id,
            ministry_id: bandMinistry.id,
            role_id: roleRecord.id,
            member_id: bandRole.member_id,
            locked: false
          });
          assignmentCount[bandRole.member_id] = (assignmentCount[bandRole.member_id] || 0) + 1;

          if (candidateProfile.family_id) {
            bandFamilyIds.add(candidateProfile.family_id);
          }
        }
      } else {
        warnings.push({
          celebrationId: celebration.id,
          celebrationStartsAt: celebration.starts_at,
          ministryId: bandMinistry.id,
          ministryName: bandMinistry.name,
          roleId: null,
          roleName: 'Banda',
          reason: 'Nenhuma banda configurada para esta celebracao'
        });
      }
    }

    for (const ministry of derivedMinistries) {
      if (
        normalizedTargetMinistry &&
        normalizedTargetMinistry !== normalizeName(ministry.name) &&
        normalizedTargetMinistry !== normalizedBandName
      ) {
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
          return availabilityMap.get(profile.user_id) === true;
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
