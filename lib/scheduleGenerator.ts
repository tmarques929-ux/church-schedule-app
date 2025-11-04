import { supabaseAdmin } from './supabaseServer';
import solver from 'javascript-lp-solver';

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
  fallbackStrategy?: FallbackStrategy;
  forceRegeneration?: boolean;
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

export interface MinistryCoverageDeficit {
  ministryId: string;
  ministryName: string;
  coverage: number;
  availableMembers: number;
  totalMembers: number;
}

export class CoverageShortfallError extends Error {
  public readonly code = 'INSUFFICIENT_MINISTRY_COVERAGE';
  public readonly requiredPercentage: number;
  public readonly deficits: MinistryCoverageDeficit[];

  constructor(requiredPercentage: number, deficits: MinistryCoverageDeficit[]) {
    super('Ministerios abaixo da cobertura minima de disponibilidade.');
    this.requiredPercentage = requiredPercentage;
    this.deficits = deficits;
  }
}

const BAND_MINISTRY_NAME = 'Bandas';
const DERIVED_MINISTRY_NAMES = ['multimidia', 'audio', 'iluminacao', 'ordem de culto'];
const SPECIAL_ELEVE_KEYWORDS = ['eleve', '30 semanas', '30-semanas', '30semana'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FallbackStrategy = 'strict' | 'placeholder' | 'notify-only';

interface MemberRolePreference {
  id: string;
  member_id: string;
  role_id: string;
  preference_type: 'prefer' | 'avoid' | 'exclusive';
  affinity_score: number;
  competency_level: number | null;
  weight: number;
}

interface AssignmentConstraint {
  id: string;
  celebration_id: string;
  ministry_id: string | null;
  role_id: string | null;
  member_id: string | null;
  family_id: string | null;
  constraint_type: 'exclude' | 'prefer' | 'require';
  priority_level: number;
  weight: number | null;
  reason: string | null;
}

interface AssignmentSlotCandidate {
  memberId: string;
  profile: Profile;
  score: number;
  hardBlocked: boolean;
  notes: string[];
}

interface AssignmentSlot {
  slotId: string;
  celebrationId: string;
  celebrationIndex: number;
  celebrationStartsAt: string;
  ministryId: string;
  ministryName: string;
  roleId: string;
  roleName: string;
  candidates: AssignmentSlotCandidate[];
  placeholderPenalty: number;
  requiredMemberIds: Set<string>;
  requiredFamilyIds: Set<string>;
  exclusiveMembers: Set<string>;
}

interface PlaceholderResolution {
  slot: AssignmentSlot;
  reason: string;
}

const buildAssignmentKey = (celebrationId: string, roleId: string) => `${celebrationId}::${roleId}`;

const DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = 'placeholder';
const BASE_SCORE = 100;
const FAIRNESS_WEIGHT = 9;
const COMPETENCY_WEIGHT = 8;
const FAMILY_SYNERGY_BONUS = 12;
const PREFERENCE_MULTIPLIER = 0.7;
const PRIORITY_MULTIPLIER = 15;
const AVOID_PENALTY = 220;
const EXCLUSIVE_BONUS = 45;
const PLACEHOLDER_PENALTY = 380;
const CONSECUTIVE_WINDOW_DAYS = 1;
const MINIMUM_MINISTRY_COVERAGE = 0.7;

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
  if (existingRun && !options.forceRegeneration) {
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
    { data: bandMembers },
    { data: rolePreferences },
    { data: assignmentConstraints }
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, name, family_id'),
    supabaseAdmin.from('ministries').select('*'),
    supabaseAdmin.from('roles').select('*'),
    supabaseAdmin.from('member_ministries').select('*'),
    supabaseAdmin.from('bands').select('*').eq('active', true),
    supabaseAdmin.from('band_members').select('*'),
    supabaseAdmin.from('member_role_preferences').select('*'),
    supabaseAdmin.from('assignment_constraints').select('*')
  ]);

  if (
    !profiles ||
    !ministries ||
    !roles ||
    !memberMinistries ||
    !bands ||
    !bandMembers ||
    !rolePreferences ||
    !assignmentConstraints
  ) {
    throw new Error('Erro ao carregar dados necessarios');
  }

  const { data: availabilities } = await supabaseAdmin.from('availabilities').select('*');

  const availabilityByCelebration = new Map<string, Map<string, boolean>>();
  (availabilities ?? []).forEach((availability: any) => {
    const { celebration_id, member_id, available } = availability as {
      celebration_id: string;
      member_id: string;
      available: boolean;
    };
    let map = availabilityByCelebration.get(celebration_id);
    if (!map) {
      map = new Map<string, boolean>();
      availabilityByCelebration.set(celebration_id, map);
    }
    map.set(member_id, available);
  });

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

  const membersByMinistry = new Map<string, Set<string>>();
  const ministriesByMember = new Map<string, Set<string>>();
  (memberMinistries as Array<{ member_id: string; ministry_id: string }> | null | undefined)?.forEach((record) => {
    let set = membersByMinistry.get(record.ministry_id);
    if (!set) {
      set = new Set<string>();
      membersByMinistry.set(record.ministry_id, set);
    }
    set.add(record.member_id);

    let ministriesForMember = ministriesByMember.get(record.member_id);
    if (!ministriesForMember) {
      ministriesForMember = new Set<string>();
      ministriesByMember.set(record.member_id, ministriesForMember);
    }
    ministriesForMember.add(record.ministry_id);
  });

  const memberRolePreferenceList: MemberRolePreference[] =
    (rolePreferences as MemberRolePreference[] | null | undefined) ?? [];
  const assignmentConstraintList: AssignmentConstraint[] =
    (assignmentConstraints as AssignmentConstraint[] | null | undefined) ?? [];

  const rolePreferencesByRole = new Map<string, MemberRolePreference[]>();
  memberRolePreferenceList.forEach((preference) => {
    const list = rolePreferencesByRole.get(preference.role_id) ?? [];
    list.push(preference);
    rolePreferencesByRole.set(preference.role_id, list);
  });

  const constraintsByCelebration = new Map<string, AssignmentConstraint[]>();
  assignmentConstraintList.forEach((constraint) => {
    const list = constraintsByCelebration.get(constraint.celebration_id) ?? [];
    list.push(constraint);
    constraintsByCelebration.set(constraint.celebration_id, list);
  });

  const assignmentsToInsert: Array<{
    celebration_id: string;
    ministry_id: string;
    role_id: string;
    member_id: string | null;
    locked: boolean;
    is_placeholder: boolean;
    placeholder_reason?: string | null;
  }> = [];
  const warnings: GenerationWarning[] = [];

  const normalizeName = (value: string | null | undefined) =>
    value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

  const celebrationFamilyAssignments = new Map<string, Set<string>>();
  const getAssignedFamilySet = (celebrationId: string): Set<string> => {
    let set = celebrationFamilyAssignments.get(celebrationId);
    if (!set) {
      set = new Set<string>();
      celebrationFamilyAssignments.set(celebrationId, set);
    }
    return set;
  };
  const registerFamily = (celebrationId: string, familyId: string | null | undefined) => {
    if (!familyId) return;
    const set = getAssignedFamilySet(celebrationId);
    set.add(familyId);
  };

  const profilesById = new Map<string, Profile>(
    profiles.map((profile) => [profile.user_id, profile] as [string, Profile])
  );

  const assignmentCount: Record<string, number> = {};
  existingAssignments.forEach((assignment) => {
    assignmentCount[assignment.member_id] = (assignmentCount[assignment.member_id] || 0) + 1;
    const profile = profilesById.get(assignment.member_id);
    if (profile?.family_id) {
      registerFamily(assignment.celebration_id, profile.family_id);
    }
  });

  const lockedKeys = new Set<string>();
  existingAssignments
    .filter((assignment) => assignment.locked)
    .forEach((assignment) => lockedKeys.add(buildAssignmentKey(assignment.celebration_id, assignment.role_id)));

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

  const relevantMinistries = [
    ...(bandMinistry ? [bandMinistry] : []),
    ...derivedMinistries
  ];
  const ministriesToCheck = normalizedTargetMinistry
    ? relevantMinistries.filter(
        (ministry) => normalizeName(ministry.name) === normalizedTargetMinistry
      )
    : relevantMinistries;

  if ((celebrations?.length ?? 0) > 0 && ministriesToCheck.length > 0) {
    const celebrationIdsInScope = new Set(
      (celebrations ?? []).map((celebration: any) => celebration.id as string)
    );
    const relevantMinistryIds = new Set(
      ministriesToCheck.map((ministry) => ministry.id as string)
    );
    const availableMembersByMinistry = new Map<string, Set<string>>();

    (availabilities ?? []).forEach((availability: any) => {
      const celebrationId = availability.celebration_id as string | undefined;
      const memberId = availability.member_id as string | undefined;
      if (!celebrationId || !memberId) {
        return;
      }
      if (!celebrationIdsInScope.has(celebrationId) || availability.available !== true) {
        return;
      }
      const ministriesForMember = ministriesByMember.get(memberId);
      if (!ministriesForMember) {
        return;
      }
      ministriesForMember.forEach((ministryId) => {
        if (!relevantMinistryIds.has(ministryId)) {
          return;
        }
        let set = availableMembersByMinistry.get(ministryId);
        if (!set) {
          set = new Set<string>();
          availableMembersByMinistry.set(ministryId, set);
        }
        set.add(memberId);
      });
    });

    const coverageDeficits: MinistryCoverageDeficit[] = ministriesToCheck
      .map((ministry) => {
        const totalMembers = membersByMinistry.get(ministry.id)?.size ?? 0;
        const availableMembers = availableMembersByMinistry.get(ministry.id)?.size ?? 0;
        const coverage = totalMembers === 0 ? 0 : availableMembers / totalMembers;

        return {
          ministryId: ministry.id as string,
          ministryName: ministry.name ?? 'Ministerio',
          coverage,
          availableMembers,
          totalMembers
        };
      })
      .filter(
        (item) =>
          item.totalMembers === 0 || item.coverage < MINIMUM_MINISTRY_COVERAGE
      );

    if (coverageDeficits.length > 0) {
      throw new CoverageShortfallError(MINIMUM_MINISTRY_COVERAGE, coverageDeficits);
    }
  }

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
  const celebrationsById = new Map(sortedCelebrations.map((celebration) => [celebration.id, celebration]));

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

  const celebrationIndexById = new Map<string, number>();
  const previousCelebrationById = new Map<string, string | null>();
  const nextCelebrationById = new Map<string, string | null>();
  sortedCelebrations.forEach((celebration, index) => {
    celebrationIndexById.set(celebration.id, index);
    const previousId = index > 0 ? sortedCelebrations[index - 1].id : null;
    const nextId = index < sortedCelebrations.length - 1 ? sortedCelebrations[index + 1].id : null;
    previousCelebrationById.set(celebration.id, previousId);
    nextCelebrationById.set(celebration.id, nextId);
  });

  const assignmentSlots: AssignmentSlot[] = [];
  const placeholderResolutions: PlaceholderResolution[] = [];
  const fallbackStrategy = options.fallbackStrategy ?? DEFAULT_FALLBACK_STRATEGY;
  const placeholderPenaltyMultiplier =
    fallbackStrategy === 'notify-only' ? 0.5 : fallbackStrategy === 'strict' ? 1.6 : 1;

  for (const celebration of sortedCelebrations) {
    const availabilityMap = availabilityByCelebration.get(celebration.id) ?? new Map<string, boolean>();
    const assignedFamilyIds = getAssignedFamilySet(celebration.id);
    const celebrationConstraints = constraintsByCelebration.get(celebration.id) ?? [];
    const celebrationStartsAt = celebration.starts_at as string;

    const shouldProcessBand =
      !normalizedTargetMinistry || normalizedTargetMinistry === normalizedBandName;
    if (shouldProcessBand && bandMinistry) {
      const constraintCandidates = celebrationConstraints.filter((constraint) => {
        if (constraint.ministry_id && constraint.ministry_id !== bandMinistry.id) return false;
        return true;
      });

      const defaultBandId = celebrationBandMap.get(celebration.id);
      const bandCandidatesInOrder: string[] = [];
      if (defaultBandId) {
        bandCandidatesInOrder.push(defaultBandId);
      }
      sortedBands.forEach((band) => {
        if (!bandCandidatesInOrder.includes(band.id)) {
          bandCandidatesInOrder.push(band.id);
        }
      });

      const requiredBandMemberIds = new Set(
        constraintCandidates
          .filter((constraint) => constraint.constraint_type === 'require' && constraint.member_id)
          .map((constraint) => constraint.member_id as string)
      );
      const requiredBandFamilyIds = new Set(
        constraintCandidates
          .filter((constraint) => constraint.constraint_type === 'require' && constraint.family_id)
          .map((constraint) => constraint.family_id as string)
      );
      const preferredBandMemberIds = new Set(
        constraintCandidates
          .filter((constraint) => constraint.constraint_type === 'prefer' && constraint.member_id)
          .map((constraint) => constraint.member_id as string)
      );

      let selectedBandId: string | null = null;
      for (const candidateBandId of bandCandidatesInOrder) {
        const membersOfBand = bandMemberList.filter((member) => member.band_id === candidateBandId);
        const memberIds = membersOfBand.map((member) => member.member_id);
        const familyIds = membersOfBand
          .map((member) => profilesById.get(member.member_id)?.family_id)
          .filter((familyId): familyId is string => Boolean(familyId));

        if (
          requiredBandMemberIds.size > 0 &&
          ![...requiredBandMemberIds].every((memberId) => memberIds.includes(memberId))
        ) {
          continue;
        }
        if (
          requiredBandFamilyIds.size > 0 &&
          ![...requiredBandFamilyIds].every((familyId) => familyIds.includes(familyId))
        ) {
          continue;
        }
        if (
          preferredBandMemberIds.size > 0 &&
          ![...preferredBandMemberIds].some((memberId) => memberIds.includes(memberId))
        ) {
          continue;
        }
        selectedBandId = candidateBandId;
        break;
      }

      if (!selectedBandId && bandCandidatesInOrder.length > 0) {
        selectedBandId = bandCandidatesInOrder[0];
      }

      const selectedBand = selectedBandId ? bandMapById.get(selectedBandId) ?? null : null;

      if (selectedBand) {
        const bandRoles = bandMemberList.filter((member) => member.band_id === selectedBand.id);

        if (bandRoles.length === 0) {
          warnings.push({
            celebrationId: celebration.id,
            celebrationStartsAt,
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

          const roleRecord = roles.find(
            (role) => role.ministry_id === bandMinistry.id && role.name === bandRole.role_in_band
          );
          if (!roleRecord) {
            warnings.push({
              celebrationId: celebration.id,
              celebrationStartsAt,
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
            registerFamily(celebration.id, candidateProfile.family_id);
            continue;
          }

          const roleConstraints = constraintCandidates.filter((constraint) => {
            if (constraint.role_id && constraint.role_id !== roleRecord.id) return false;
            return true;
          });

          const excludedByConstraint = roleConstraints.some((constraint) => {
            if (constraint.constraint_type !== 'exclude') return false;
            if (constraint.member_id && constraint.member_id === bandRole.member_id) return true;
            if (
              constraint.family_id &&
              candidateProfile.family_id &&
              constraint.family_id === candidateProfile.family_id
            ) {
              return true;
            }
            return false;
          });

          const availability = availabilityMap.get(bandRole.member_id);
          if (availability !== true || excludedByConstraint) {
            const reason =
              availability === false
                ? 'Membro da banda marcou indisponivel'
                : availability === undefined
                ? 'Membro da banda sem confirmacao de disponibilidade'
                : roleConstraints.find((constraint) => constraint.constraint_type === 'exclude')?.reason ??
                  'Restricao de exclusao para este membro/familia';

            warnings.push({
              celebrationId: celebration.id,
              celebrationStartsAt,
              ministryId: bandMinistry.id,
              ministryName: bandMinistry.name,
              roleId: roleRecord.id,
              roleName: bandRole.role_in_band,
              reason
            });
            assignmentsToInsert.push({
              celebration_id: celebration.id,
              ministry_id: bandMinistry.id,
              role_id: roleRecord.id,
              member_id: null,
              locked: false,
              is_placeholder: true,
              placeholder_reason: reason
            });
            continue;
          }

          assignmentsToInsert.push({
            celebration_id: celebration.id,
            ministry_id: bandMinistry.id,
            role_id: roleRecord.id,
            member_id: bandRole.member_id,
            locked: false,
            is_placeholder: false
          });
          assignmentCount[bandRole.member_id] = (assignmentCount[bandRole.member_id] || 0) + 1;
          registerFamily(celebration.id, candidateProfile.family_id);
        }
      } else {
        warnings.push({
          celebrationId: celebration.id,
          celebrationStartsAt,
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
      const ministryConstraints = celebrationConstraints.filter((constraint) => {
        if (constraint.ministry_id && constraint.ministry_id !== ministry.id) return false;
        return true;
      });

      for (const role of ministryRoles) {
        const assignmentKey = buildAssignmentKey(celebration.id, role.id);
        if (lockedKeys.has(assignmentKey) && options.preserveLocked) {
          continue;
        }

        const constraintsForSlot = ministryConstraints.filter((constraint) => {
          if (constraint.role_id && constraint.role_id !== role.id) return false;
          return true;
        });

        const requiredMemberIds = new Set<string>();
        const requiredFamilyIds = new Set<string>();
        const exclusiveMembers = new Set<string>();

        constraintsForSlot.forEach((constraint) => {
          if (constraint.constraint_type === 'require') {
            if (constraint.member_id) requiredMemberIds.add(constraint.member_id);
            if (constraint.family_id) requiredFamilyIds.add(constraint.family_id);
          }
        });

        const rolePreferenceList = rolePreferencesByRole.get(role.id) ?? [];
        const preferencesByMember = new Map<string, MemberRolePreference[]>();
        rolePreferenceList.forEach((preference) => {
          const list = preferencesByMember.get(preference.member_id) ?? [];
          list.push(preference);
          preferencesByMember.set(preference.member_id, list);
          if (preference.preference_type === 'exclusive') {
            exclusiveMembers.add(preference.member_id);
          }
        });

        const candidateIds = membersByMinistry.get(ministry.id);
        const slotCandidates: AssignmentSlotCandidate[] = [];

        candidateIds?.forEach((memberId) => {
          const profile = profilesById.get(memberId);
          if (!profile) return;

          const availability = availabilityMap.get(memberId);
          if (availability !== true) {
            return;
          }

          const familyId = profile.family_id ?? undefined;

          if (
            requiredMemberIds.size > 0 &&
            !requiredMemberIds.has(memberId) &&
            (!familyId || !requiredFamilyIds.has(familyId))
          ) {
            return;
          }

          if (exclusiveMembers.size > 0 && !exclusiveMembers.has(memberId)) {
            return;
          }

          const isExcluded = constraintsForSlot.some((constraint) => {
            if (constraint.constraint_type !== 'exclude') return false;
            if (constraint.member_id && constraint.member_id === memberId) return true;
            if (constraint.family_id && familyId && constraint.family_id === familyId) return true;
            return false;
          });
          if (isExcluded) {
            return;
          }

          let score = BASE_SCORE;
          const notes: string[] = [];
          score -= (assignmentCount[memberId] || 0) * FAIRNESS_WEIGHT;

          const memberPreferences = preferencesByMember.get(memberId) ?? [];
          memberPreferences.forEach((preference) => {
            if (preference.preference_type === 'prefer') {
              score += preference.affinity_score * PREFERENCE_MULTIPLIER + preference.weight * 10;
              notes.push('preferencia');
            }
            if (preference.preference_type === 'avoid') {
              score -= AVOID_PENALTY * preference.weight;
              notes.push('evitar');
            }
            if (preference.preference_type === 'exclusive') {
              score += EXCLUSIVE_BONUS;
            }
            if (preference.competency_level !== null && preference.competency_level !== undefined) {
              score += preference.competency_level * COMPETENCY_WEIGHT;
            }
          });

          if (familyId && assignedFamilyIds.has(familyId)) {
            score += FAMILY_SYNERGY_BONUS;
          }

          constraintsForSlot.forEach((constraint) => {
            if (constraint.constraint_type === 'prefer') {
              const appliesToMember =
                (constraint.member_id && constraint.member_id === memberId) ||
                (constraint.family_id && familyId && constraint.family_id === familyId);
              if (appliesToMember) {
                const weightMultiplier = constraint.weight ?? 1;
                score +=
                  weightMultiplier * PREFERENCE_MULTIPLIER * 10 +
                  constraint.priority_level * PRIORITY_MULTIPLIER;
              }
            } else if (constraint.constraint_type === 'require') {
              const appliesToMember =
                (constraint.member_id && constraint.member_id === memberId) ||
                (constraint.family_id && familyId && constraint.family_id === familyId);
              if (appliesToMember) {
                score += PRIORITY_MULTIPLIER * (constraint.priority_level + 2);
              }
            }
          });

          const candidate: AssignmentSlotCandidate = {
            memberId,
            profile,
            score,
            hardBlocked: false,
            notes
          };
          slotCandidates.push(candidate);
        });

        const highestPriorityInSlot = constraintsForSlot.reduce(
          (accumulator, constraint) => Math.max(accumulator, constraint.priority_level ?? 0),
          0
        );

        const slot: AssignmentSlot = {
          slotId: assignmentKey,
          celebrationId: celebration.id,
          celebrationIndex: celebrationIndexById.get(celebration.id) ?? 0,
          celebrationStartsAt,
          ministryId: ministry.id,
          ministryName: ministry.name,
          roleId: role.id,
          roleName: role.name,
          candidates: slotCandidates,
          placeholderPenalty:
            PLACEHOLDER_PENALTY * placeholderPenaltyMultiplier +
            highestPriorityInSlot * PRIORITY_MULTIPLIER,
          requiredMemberIds,
          requiredFamilyIds,
          exclusiveMembers
        };

        assignmentSlots.push(slot);

        if (slotCandidates.length === 0) {
          const reason =
            requiredMemberIds.size > 0 || requiredFamilyIds.size > 0
              ? 'Restricoes de prioridade sem candidatos elegiveis'
              : 'Nenhum membro disponivel';
          warnings.push({
            celebrationId: celebration.id,
            celebrationStartsAt,
            ministryId: ministry.id,
            ministryName: ministry.name,
            roleId: role.id,
            roleName: role.name,
            reason
          });
          placeholderResolutions.push({ slot, reason });
        }
      }
    }
  }

  let optimizationScore: number | null = null;
  let usedGreedyFallback = false;
  const placeholderSlotIds = new Set(
    placeholderResolutions.map((placeholder) => placeholder.slot.slotId)
  );

  if (assignmentSlots.length > 0) {
    const memberIdsInScope = new Set<string>();
    assignmentSlots.forEach((slot) => {
      slot.candidates.forEach((candidate) => memberIdsInScope.add(candidate.memberId));
    });

    const totalSlots = assignmentSlots.length;
    const memberCount = Math.max(memberIdsInScope.size, 1);
    const baseLimit = Math.ceil(totalSlots / memberCount) + 1;

    const model: any = {
      optimize: 'score',
      opType: 'max',
      constraints: {},
      variables: {},
      ints: {}
    };

    const ensureConstraint = (name: string, type: 'max' | 'min' | 'equal', value: number) => {
      if (!model.constraints[name]) {
        model.constraints[name] = {};
      }
      if (model.constraints[name][type] === undefined) {
        model.constraints[name][type] = value;
      } else if (type === 'max') {
        model.constraints[name][type] = Math.min(model.constraints[name][type], value);
      } else if (type === 'min') {
        model.constraints[name][type] = Math.max(model.constraints[name][type], value);
      } else {
        model.constraints[name][type] = value;
      }
    };

    const memberLimits = new Map<string, number>();
    memberIdsInScope.forEach((memberId) => {
      const limit = Math.max(baseLimit, (assignmentCount[memberId] || 0) + baseLimit);
      memberLimits.set(memberId, limit);
      ensureConstraint(`member_total_${memberId}`, 'max', limit);
    });

    for (const slot of assignmentSlots) {
      const slotConstraintName = `slot_${slot.slotId}`;
      ensureConstraint(slotConstraintName, 'equal', 1);

      const placeholderVarName = `placeholder_${slot.slotId}`;
      model.variables[placeholderVarName] = {
        score: -slot.placeholderPenalty,
        [slotConstraintName]: 1,
        placeholder_count: 1
      };
      model.ints[placeholderVarName] = 1;

      for (const candidate of slot.candidates) {
        const varName = `assign_${slot.slotId}_${candidate.memberId}`;
        const variable: Record<string, number> = {
          score: candidate.score,
          [slotConstraintName]: 1,
          [`member_total_${candidate.memberId}`]: 1
        };

        const celebrationConstraintName = `member_celebration_${candidate.memberId}_${slot.celebrationId}`;
        ensureConstraint(celebrationConstraintName, 'max', 1);
        variable[celebrationConstraintName] = 1;

        const previousId = previousCelebrationById.get(slot.celebrationId);
        if (previousId) {
          const previousCelebration = celebrationsById.get(previousId);
          if (previousCelebration) {
            const diffInDays =
              Math.abs(
                new Date(slot.celebrationStartsAt).getTime() -
                  new Date(previousCelebration.starts_at as string).getTime()
              ) / MS_PER_DAY;
            if (diffInDays <= CONSECUTIVE_WINDOW_DAYS) {
              const consecutiveConstraintName = `consecutive_${candidate.memberId}_${previousId}_${slot.celebrationId}`;
              ensureConstraint(consecutiveConstraintName, 'max', 1);
              variable[consecutiveConstraintName] = 1;
            }
          }
        }

        model.variables[varName] = variable;
        model.ints[varName] = 1;
      }
    }

    let solution: any = null;
    try {
      solution = solver.Solve(model);
    } catch (error) {
      console.error('Erro ao resolver modelo de otimizacao de escala', error);
      solution = null;
    }

    const slotResultById = new Map<
      string,
      { candidate: AssignmentSlotCandidate | null; reason?: string }
    >();

    const isFeasible =
      solution && solution.feasible !== false && typeof solution.result === 'number';

    if (isFeasible) {
      optimizationScore =
        solution && typeof solution.result === 'number' ? Number(solution.result) : null;
      for (const slot of assignmentSlots) {
        let assignedCandidate: AssignmentSlotCandidate | null = null;
        for (const candidate of slot.candidates) {
          const varName = `assign_${slot.slotId}_${candidate.memberId}`;
          if (Number(solution[varName]) === 1) {
            assignedCandidate = candidate;
            break;
          }
        }
        if (!assignedCandidate && Number(solution[`placeholder_${slot.slotId}`]) === 1) {
          slotResultById.set(slot.slotId, {
            candidate: null,
            reason: 'Modelo otimo indica necessidade de placeholder para revisao manual'
          });
        } else if (assignedCandidate) {
          slotResultById.set(slot.slotId, { candidate: assignedCandidate });
        } else {
          slotResultById.set(slot.slotId, {
            candidate: null,
            reason: 'Distribuicao nao determinada pelo solver'
          });
        }
      }
    } else {
      optimizationScore = null;
      usedGreedyFallback = true;
      const assignedMembersByCelebration = new Map<string, Set<string>>();
      const totalAssignmentsForMember = new Map<string, number>();
      const lastCelebrationIndexForMember = new Map<string, number>();

      const sortedSlotsForGreedy = [...assignmentSlots].sort(
        (a, b) => a.candidates.length - b.candidates.length
      );

      for (const slot of sortedSlotsForGreedy) {
        const celebrationSet =
          assignedMembersByCelebration.get(slot.celebrationId) ?? new Set<string>();
        let assignedCandidate: AssignmentSlotCandidate | null = null;

        const sortedCandidates = [...slot.candidates].sort((a, b) => b.score - a.score);

        for (const candidate of sortedCandidates) {
          if (celebrationSet.has(candidate.memberId)) {
            continue;
          }
          const memberBaseCount = assignmentCount[candidate.memberId] || 0;
          const currentAssigned = totalAssignmentsForMember.get(candidate.memberId) ?? 0;
          const allowedLimit = memberLimits.get(candidate.memberId) ?? baseLimit + memberBaseCount;
          if (memberBaseCount + currentAssigned >= allowedLimit) {
            continue;
          }
          const lastIndex = lastCelebrationIndexForMember.get(candidate.memberId);
          const currentIndex = celebrationIndexById.get(slot.celebrationId) ?? 0;
          if (lastIndex !== undefined && currentIndex - lastIndex <= 1) {
            continue;
          }
          assignedCandidate = candidate;
          celebrationSet.add(candidate.memberId);
          assignedMembersByCelebration.set(slot.celebrationId, celebrationSet);
          totalAssignmentsForMember.set(candidate.memberId, currentAssigned + 1);
          lastCelebrationIndexForMember.set(candidate.memberId, currentIndex);
          break;
        }

        if (assignedCandidate) {
          slotResultById.set(slot.slotId, { candidate: assignedCandidate });
        } else {
          slotResultById.set(slot.slotId, {
            candidate: null,
            reason: 'Alocacao impossivel nas restricoes (fallback greedy)'
          });
        }
      }
    }

    for (const slot of assignmentSlots) {
      const result = slotResultById.get(slot.slotId);
      if (result?.candidate) {
        assignmentsToInsert.push({
          celebration_id: slot.celebrationId,
          ministry_id: slot.ministryId,
          role_id: slot.roleId,
          member_id: result.candidate.memberId,
          locked: false,
          is_placeholder: false
        });
        assignmentCount[result.candidate.memberId] =
          (assignmentCount[result.candidate.memberId] || 0) + 1;
        registerFamily(slot.celebrationId, result.candidate.profile.family_id);
      } else {
        const placeholderReason =
          result?.reason ??
          placeholderResolutions.find((placeholder) => placeholder.slot.slotId === slot.slotId)
            ?.reason ??
          'Nenhum membro elegivel';
        assignmentsToInsert.push({
          celebration_id: slot.celebrationId,
          ministry_id: slot.ministryId,
          role_id: slot.roleId,
          member_id: null,
          locked: false,
          is_placeholder: true,
          placeholder_reason: placeholderReason
        });
        if (!placeholderSlotIds.has(slot.slotId)) {
          placeholderSlotIds.add(slot.slotId);
          placeholderResolutions.push({ slot, reason: placeholderReason });
          warnings.push({
            celebrationId: slot.celebrationId,
            celebrationStartsAt: slot.celebrationStartsAt,
            ministryId: slot.ministryId,
            ministryName: slot.ministryName,
            roleId: slot.roleId,
            roleName: slot.roleName,
            reason: placeholderReason
          });
        }
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

  const generationParameters = {
    month,
    year,
    options: {
      ministry: options.ministry ?? null,
      preserveLocked: options.preserveLocked ?? false,
      allowIncomplete,
      fallbackStrategy: fallbackStrategy ?? DEFAULT_FALLBACK_STRATEGY,
      forceRegeneration: options.forceRegeneration ?? false
    },
    placeholderSlots: placeholderResolutions.map((placeholder) => ({
      celebrationId: placeholder.slot.celebrationId,
      ministryId: placeholder.slot.ministryId,
      roleId: placeholder.slot.roleId,
      reason: placeholder.reason
    })),
    usedGreedyFallback
  };

  try {
    const { data: latestVersion } = await supabaseAdmin
      .from('schedule_run_versions')
      .select('version_number')
      .eq('schedule_run_id', scheduleRunId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    await supabaseAdmin.from('schedule_run_versions').insert({
      schedule_run_id: scheduleRunId,
      version_number: nextVersionNumber,
      generated_by: options.createdBy,
      generation_parameters: generationParameters,
      objective_score: optimizationScore,
      warnings
    });
  } catch (error) {
    console.error('Falha ao registrar historico da escala gerada', error);
  }

  return { scheduleRunId, assignments: assignmentsToInsert, warnings };
}
