"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@lib/supabaseClient';

interface ScheduleRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'published' | string;
}

interface ScheduleCelebrationDownload {
  id: string;
  title: string;
  dateLabel: string;
  location: string | null;
}

interface AssignmentRow {
  assignmentId: string;
  celebrationId: string | null;
  date: string | null;
  location: string | null;
  ministryId: string | null;
  ministry: string | null;
  roleId: string | null;
  role: string | null;
  memberId: string | null;
  memberName: string | null;
  member: string | null;
  locked: boolean;
  isPlaceholder: boolean;
  placeholderReason: string | null;
}

type ScheduleDetail = {
  assignments: AssignmentRow[];
  references?: {
    celebrations?: Array<{
      id: string;
      starts_at: string | null;
      location: string | null;
      notes: string | null;
    }>;
  };
};

type MinistryDirectoryMember = {
  userId: string;
  name: string;
  username: string | null;
};

type MinistryDirectoryEntry = {
  id: string;
  name: string;
  active: boolean;
  members: MinistryDirectoryMember[];
};

type AssignmentDraft = {
  memberId?: string;
  placeholderReason?: string;
};

type ManualAlert = {
  type: "success" | "error";
  message: string;
};

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-200 border-yellow-300/40',
  published: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40'
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRun[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingRegenerate, setLoadingRegenerate] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [scheduleCelebrations, setScheduleCelebrations] = useState<
    Record<string, ScheduleCelebrationDownload[]>
  >({});
  const [loadingCelebrations, setLoadingCelebrations] = useState<Record<string, boolean>>({});
  const [celebrationsError, setCelebrationsError] = useState<Record<string, string | null>>({});
  const [feedbackExpandedId, setFeedbackExpandedId] = useState<string | null>(null);
  const [feedbackBySchedule, setFeedbackBySchedule] = useState<Record<string, any[]>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<Record<string, string | null>>({});
  const [feedbackDraft, setFeedbackDraft] = useState<
    Record<
      string,
      {
        comment: string;
        category: 'availability' | 'competency' | 'preference' | 'fairness' | 'other';
        severity: 'low' | 'medium' | 'high' | 'critical';
      }
    >
  >({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<Record<string, boolean>>({});
  const [managerRole, setManagerRole] = useState<"ADMIN" | "LEADER" | "MEMBER">("MEMBER");
  const [managedMinistryIds, setManagedMinistryIds] = useState<string[]>([]);
  const [managerLoading, setManagerLoading] = useState(true);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [ministryDirectory, setMinistryDirectory] = useState<Record<string, MinistryDirectoryEntry>>({});
  const [ministryDirectoryLoading, setMinistryDirectoryLoading] = useState(false);
  const [ministryDirectoryError, setMinistryDirectoryError] = useState<string | null>(null);
  const [scheduleDetails, setScheduleDetails] = useState<Record<string, ScheduleDetail>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [assignmentSaving, setAssignmentSaving] = useState<Record<string, boolean>>({});
  const [availabilityDrafts, setAvailabilityDrafts] = useState<Record<string, string>>({});
  const [availabilitySaving, setAvailabilitySaving] = useState<Record<string, boolean>>({});
  const [manualAlerts, setManualAlerts] = useState<Record<string, ManualAlert | null>>({});
  const canManageSchedules =
    managerRole === "ADMIN" || (managerRole === "LEADER" && managedMinistryIds.length > 0);

  const canManageMinistryLocally = useCallback(
    (ministryId: string | null | undefined) => {
      if (managerRole === "ADMIN") {
        return true;
      }
      if (!ministryId) {
        return false;
      }
      return managedMinistryIds.includes(ministryId);
    },
    [managerRole, managedMinistryIds]
  );

  const resolveMemberDisplayName = useCallback(
    (name: string | null | undefined, username: string | null | undefined) => {
      const normalizedUsername = username?.trim().toLowerCase();
      if (normalizedUsername === "thiagomrib") {
        return "Thiago Marques Ribeiro";
      }
      const trimmed = name?.trim();
      if (trimmed && trimmed.length > 0) {
        return trimmed;
      }
      return username ?? "Voluntario";
    },
    []
  );

  const resolveMemberLabel = useCallback(
    (memberId: string | null | undefined, ministryId: string | null | undefined) => {
      if (!memberId) {
        return "PENDENTE";
      }
      if (ministryId && ministryDirectory[ministryId]) {
        const entry = ministryDirectory[ministryId].members.find(
          (member) => member.userId === memberId
        );
        if (entry) {
          return entry.name;
        }
      }
      return "Voluntario";
    },
    [ministryDirectory]
  );

  const buildAvailabilityKey = useCallback(
    (celebrationId: string | null | undefined, ministryId: string | null | undefined) => {
      if (!celebrationId) {
        return "unknown";
      }
      return `${celebrationId}:${ministryId ?? "none"}`;
    },
    []
  );

  const getManualCelebrations = useCallback(
    (scheduleId: string) => {
      const detail = scheduleDetails[scheduleId];
      if (!detail) {
        return [];
      }
      const celebrationLookup = new Map<
        string,
        { id: string; starts_at: string | null; location: string | null; notes: string | null }
      >();
      detail.references?.celebrations?.forEach((celebration: any) => {
        if (celebration?.id) {
          celebrationLookup.set(celebration.id, celebration);
        }
      });
      const map = new Map<
        string,
        {
          id: string;
          date: string | null;
          location: string | null;
          notes: string | null;
          ministries: Map<
            string,
            {
              ministryId: string | null;
              ministryName: string;
              assignments: AssignmentRow[];
            }
          >;
        }
      >();
      detail.assignments.forEach((assignment) => {
        if (!assignment.celebrationId) {
          return;
        }
        if (!map.has(assignment.celebrationId)) {
          const reference = celebrationLookup.get(assignment.celebrationId);
          map.set(assignment.celebrationId, {
            id: assignment.celebrationId,
            date: reference?.starts_at ?? assignment.date ?? null,
            location: reference?.location ?? assignment.location ?? null,
            notes: reference?.notes ?? null,
            ministries: new Map()
          });
        }
        const celebrationEntry = map.get(assignment.celebrationId)!;
        const ministryKey = assignment.ministryId ?? `unknown-${assignment.celebrationId}`;
        if (!celebrationEntry.ministries.has(ministryKey)) {
          celebrationEntry.ministries.set(ministryKey, {
            ministryId: assignment.ministryId,
            ministryName: assignment.ministry ?? "Ministerio",
            assignments: []
          });
        }
        celebrationEntry.ministries.get(ministryKey)!.assignments.push(assignment);
      });
      return Array.from(map.values())
        .sort((a, b) => {
          if (!a.date || !b.date) {
            return a.id.localeCompare(b.id);
          }
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .map((entry) => ({
          ...entry,
          ministries: Array.from(entry.ministries.values()).sort((a, b) =>
            a.ministryName.localeCompare(b.ministryName)
          )
        }));
    },
    [scheduleDetails]
  );

  const loadSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedule_runs')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    setSchedules((data as ScheduleRun[]) ?? []);
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    async function loadManagerInfo() {
      setManagerLoading(true);
      setManagerError(null);
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user?.id) {
          setManagerRole("MEMBER");
          setManagedMinistryIds([]);
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) {
          throw profileError;
        }
        const resolvedRole =
          profile?.role === "ADMIN" || profile?.role === "LEADER" ? profile.role : "MEMBER";
        setManagerRole(resolvedRole as "ADMIN" | "LEADER" | "MEMBER");
        if (resolvedRole === "LEADER") {
          const { data: ministryRows, error: ministryError } = await supabase
            .from("member_ministries")
            .select("ministry_id, is_leader")
            .eq("member_id", user.id);
          if (ministryError) {
            throw ministryError;
          }
          const leaderIds =
            ministryRows
              ?.filter((row: any) => row.is_leader)
              .map((row: any) => row.ministry_id)
              .filter((id: string | null | undefined): id is string => Boolean(id)) ?? [];
          setManagedMinistryIds(leaderIds);
        } else {
          setManagedMinistryIds([]);
        }
      } catch (caught) {
        setManagerRole("MEMBER");
        setManagedMinistryIds([]);
        setManagerError(
          caught instanceof Error ? caught.message : "Nao foi possivel carregar suas permissoes."
        );
      } finally {
        setManagerLoading(false);
      }
    }
    loadManagerInfo();
  }, []);

  useEffect(() => {
    if (!canManageSchedules) {
      setMinistryDirectory({});
      setMinistryDirectoryError(null);
      return;
    }
    async function loadDirectory() {
      setMinistryDirectoryLoading(true);
      setMinistryDirectoryError(null);
      try {
        const response = await fetch("/api/ministries?includeMembers=true");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar os ministerios.");
        }
        const entries: Record<string, MinistryDirectoryEntry> = {};
        (json.ministries ?? []).forEach((ministry: any) => {
          entries[ministry.id] = {
            id: ministry.id,
            name: ministry.name,
            active: Boolean(ministry.active),
            members:
              ministry.members?.map((member: any) => ({
                userId: member.userId,
                name: resolveMemberDisplayName(member.name, member.username),
                username: member.username ?? null
              })) ?? []
          };
        });
        setMinistryDirectory(entries);
      } catch (caught) {
        setMinistryDirectory({});
        setMinistryDirectoryError(
          caught instanceof Error
            ? caught.message
            : "Erro inesperado ao carregar ministerios."
        );
      } finally {
        setMinistryDirectoryLoading(false);
      }
    }
    loadDirectory();
  }, [canManageSchedules, resolveMemberDisplayName]);

  const selectedPeriod = useMemo(() => {
    if (!month) return null;
    const [yearStr, monthStr] = month.split('-');
    const parsedYear = Number(yearStr);
    const parsedMonth = Number(monthStr);
    if (Number.isNaN(parsedYear) || Number.isNaN(parsedMonth)) {
      return null;
    }
    return { year: parsedYear, month: parsedMonth };
  }, [month]);

  const existingScheduleForSelection = useMemo(() => {
    if (!selectedPeriod) return null;
    return (
      schedules.find(
        (schedule) =>
          schedule.year === selectedPeriod.year && schedule.month === selectedPeriod.month
      ) ?? null
    );
  }, [schedules, selectedPeriod]);

  const groupedByYear = useMemo(() => {
    return schedules.reduce<Record<number, ScheduleRun[]>>((accumulator, schedule) => {
      if (!accumulator[schedule.year]) {
        accumulator[schedule.year] = [];
      }
      accumulator[schedule.year].push(schedule);
      return accumulator;
    }, {});
  }, [schedules]);

  function formatCoverageDeficits(deficits?: any[], requiredPercentage?: number) {
    if (!Array.isArray(deficits) || deficits.length === 0) {
      return null;
    }
    const requiredPercent = Math.round(((requiredPercentage ?? 0.7) as number) * 100);
    return deficits
      .map((item) => {
        const name = item?.ministryName ?? 'Ministerio';
        const totalMembers =
          typeof item?.totalMembers === 'number' && !Number.isNaN(item.totalMembers)
            ? item.totalMembers
            : 0;
        const availableMembers =
          typeof item?.availableMembers === 'number' && !Number.isNaN(item.availableMembers)
            ? item.availableMembers
            : 0;
        const rawCoverage =
          typeof item?.coverage === 'number' && !Number.isNaN(item.coverage)
            ? item.coverage
            : totalMembers > 0
            ? availableMembers / totalMembers
            : 0;
        const currentPercent = Math.round(rawCoverage * 100);
        if (totalMembers === 0) {
          return `${name}: nenhum membro confirmado (minimo ${requiredPercent}%)`;
        }
        return `${name}: ${currentPercent}% (${availableMembers}/${totalMembers}) - minimo ${requiredPercent}%`;
      })
      .join(' | ');
  }

  async function handleGenerate() {
    if (!month) return;
    if (existingScheduleForSelection) {
      setError('Ja existe uma escala para este periodo. Apague-a antes de gerar novamente.');
      setSuccess(null);
      return;
    }
    setLoadingGenerate(true);
    setError(null);
    setSuccess(null);
  const response = await fetch(`/api/schedules/generate?month=${month}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowPlaceholders: true, fallbackStrategy: "placeholder" })
    });
    const json = await response.json();
    if (!response.ok) {
      const coverageMessage = formatCoverageDeficits(json.deficits, json.requiredPercentage);
      setError(
        coverageMessage
          ? `${json.error || "Nao foi possivel gerar nova escala."} ${coverageMessage}`
          : json.error || "Erro ao gerar nova escala. Revise suas permissoes ou tente novamente."
      );
    } else {
      setSuccess("Escala gerada com sucesso! Reveja os detalhes antes de publicar.");
      await loadSchedules();
    }
    setLoadingGenerate(false);
  }

  async function handleRegenerate() {
    if (!month) return;
    if (!existingScheduleForSelection) {
      setError('Nao ha escala cadastrada para apagar neste periodo.');
      setSuccess(null);
      return;
    }
    setLoadingRegenerate(true);
    setError(null);
    setSuccess(null);
    const deleteResponse = await fetch(`/api/schedules/by-period?month=${month}`, {
      method: "DELETE"
    });
    const deleteJson = await deleteResponse.json().catch(() => ({}));
    if (!deleteResponse.ok) {
      setError(deleteJson.error || "Nao foi possivel remover a escala atual.");
      setLoadingRegenerate(false);
      return;
    }
  const response = await fetch(`/api/schedules/generate?month=${month}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowPlaceholders: true, fallbackStrategy: "placeholder" })
    });
    const json = await response.json();
    if (!response.ok) {
      const coverageMessage = formatCoverageDeficits(json.deficits, json.requiredPercentage);
      setError(
        coverageMessage
          ? `${json.error || "Nao foi possivel gerar a nova escala."} ${coverageMessage}`
          : json.error || "Nao foi possivel gerar a nova escala."
      );
    } else {
      setSuccess("Escala anterior removida e nova escala criada com sucesso!");
      await loadSchedules();
    }
    setLoadingRegenerate(false);
  }

  async function publish(id: string) {
    setLoadingPublish(id);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/schedules/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Nao foi possivel publicar a escala.");
      setLoadingPublish(null);
      return;
    }

    const notificationsInfo =
      typeof json.notificationsDispatched === 'number'
        ? ` Notificacoes enviadas: ${json.notificationsDispatched}.`
        : '';
    setSuccess(`Escala publicada! As equipes ja podem consultar no painel.${notificationsInfo}`);

    if (json?.calendar?.content) {
      try {
        const binary = atob(json.calendar.content as string);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        const blob = new Blob([bytes], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = (json.calendar.filename as string) || `escala-${id}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } catch (icsError) {
        console.error('Falha ao preparar arquivo ICS', icsError);
      }
    }

    await loadSchedules();
    setLoadingPublish(null);
  }

    async function toggleCelebrations(scheduleId: string) {
      if (expandedScheduleId === scheduleId) {
        setExpandedScheduleId(null);
        return;
      }

      setExpandedScheduleId(scheduleId);

    if (scheduleCelebrations[scheduleId] !== undefined || loadingCelebrations[scheduleId]) {
      return;
    }

      setLoadingCelebrations((prev) => ({ ...prev, [scheduleId]: true }));
      setCelebrationsError((prev) => ({ ...prev, [scheduleId]: null }));

      try {
        const response = await fetch(`/api/schedules/${scheduleId}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Nao foi possivel carregar as celebracoes.");
        }

        const celebrationMap = new Map<
          string,
          { id: string; title: string | null; date: string | null; location: string | null }
        >();

        (payload?.references?.celebrations ?? []).forEach((celebration: any) => {
          celebrationMap.set(celebration.id, {
            id: celebration.id,
            title: celebration.notes ?? celebration.title ?? null,
            date: celebration.starts_at ?? null,
            location: celebration.location ?? null
          });
        });

        (payload?.assignments ?? []).forEach((assignment: any) => {
          if (!assignment.celebrationId) {
            return;
          }
          const current =
            celebrationMap.get(assignment.celebrationId) ??
            {
              id: assignment.celebrationId,
              title: null,
              date: null,
              location: null
            };
          if (!current.date && assignment.date) {
            current.date = assignment.date;
          }
          if (!current.location && assignment.location) {
            current.location = assignment.location;
          }
          if (!current.title) {
            current.title = assignment.ministry ? `Celebracao ${assignment.ministry}` : null;
          }
          celebrationMap.set(assignment.celebrationId, current);
        });

        const celebrationsList = Array.from(celebrationMap.values())
          .sort((a, b) => {
            if (!a.date || !b.date) {
              return (a.title ?? "").localeCompare(b.title ?? "");
            }
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          })
          .map((item, index) => {
            const baseTitle = item.title ?? `Celebracao ${index + 1}`;
            const dateLabel = item.date
              ? new Date(item.date).toLocaleString("pt-BR", {
                  dateStyle: "full",
                  timeStyle: "short"
                })
              : "Data a definir";
            return {
              id: item.id,
              title: baseTitle,
              dateLabel,
              location: item.location ?? null
            } as ScheduleCelebrationDownload;
          });

        setScheduleCelebrations((prev) => ({
          ...prev,
          [scheduleId]: celebrationsList
        }));
        setScheduleDetails((prev) => ({
          ...prev,
          [scheduleId]: {
            assignments: Array.isArray(payload?.assignments)
              ? (payload.assignments as AssignmentRow[])
              : [],
            references: payload?.references ?? {}
          }
        }));
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Nao foi possivel carregar as celebracoes.";
        setCelebrationsError((prev) => ({
          ...prev,
          [scheduleId]: message
        }));
      } finally {
        setLoadingCelebrations((prev) => ({
          ...prev,
          [scheduleId]: false
        }));
      }
    }

  async function toggleFeedback(scheduleId: string) {
    if (feedbackExpandedId === scheduleId) {
      setFeedbackExpandedId(null);
      return;
    }
    setFeedbackExpandedId(scheduleId);
    if (feedbackBySchedule[scheduleId] !== undefined || feedbackLoading[scheduleId]) {
      return;
    }
    setFeedbackLoading((prev) => ({ ...prev, [scheduleId]: true }));
    setFeedbackError((prev) => ({ ...prev, [scheduleId]: null }));
    try {
      const response = await fetch(`/api/schedules/feedback?scheduleRunId=${scheduleId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel carregar o feedback.');
      }
      setFeedbackBySchedule((prev) => ({ ...prev, [scheduleId]: payload.feedback ?? [] }));
      setFeedbackDraft((prev) => ({
        ...prev,
        [scheduleId]:
          prev[scheduleId] ?? {
            comment: '',
            category: 'other',
            severity: 'medium'
          }
      }));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Erro inesperado ao carregar feedback.';
      setFeedbackError((prev) => ({ ...prev, [scheduleId]: message }));
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [scheduleId]: false }));
    }
  }

  async function submitFeedback(scheduleId: string) {
    const draft = feedbackDraft[scheduleId];
    if (!draft || !draft.comment.trim()) {
      setFeedbackError((prev) => ({
        ...prev,
        [scheduleId]: 'Informe um comentario antes de enviar.'
      }));
      return;
    }
    setFeedbackSubmitting((prev) => ({ ...prev, [scheduleId]: true }));
    setFeedbackError((prev) => ({ ...prev, [scheduleId]: null }));
    try {
      const response = await fetch('/api/schedules/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleRunId: scheduleId,
          comment: draft.comment,
          category: draft.category,
          severity: draft.severity
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel registrar o feedback.');
      }
      setFeedbackBySchedule((prev) => ({
        ...prev,
        [scheduleId]: [payload.feedback, ...(prev[scheduleId] ?? [])]
      }));
      setFeedbackDraft((prev) => ({
        ...prev,
        [scheduleId]: { ...draft, comment: '' }
      }));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Erro inesperado ao salvar feedback.';
      setFeedbackError((prev) => ({ ...prev, [scheduleId]: message }));
    } finally {
      setFeedbackSubmitting((prev) => ({ ...prev, [scheduleId]: false }));
    }
  }

  const handleAssignmentSave = useCallback(
    async (scheduleId: string, assignmentId: string) => {
      const detail = scheduleDetails[scheduleId];
      if (!detail) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message: "Carregue as celebracoes antes de ajustar a escala."
          }
        }));
        return;
      }
      const currentAssignment = detail.assignments.find(
        (assignment) => assignment.assignmentId === assignmentId
      );
      if (!currentAssignment) {
        return;
      }
      const draft = assignmentDrafts[assignmentId];
      const nextMemberId = draft?.memberId ?? currentAssignment.memberId;
      if (!nextMemberId) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message: "Selecione um voluntario para atribuir a funcao."
          }
        }));
        return;
      }
      setAssignmentSaving((prev) => ({ ...prev, [assignmentId]: true }));
      setManualAlerts((prev) => ({ ...prev, [scheduleId]: null }));
      try {
        const response = await fetch("/api/assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, memberId: nextMemberId })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel atualizar a escala.");
        }
        const updated = json.assignment;
        setScheduleDetails((prev) => {
          const current = prev[scheduleId];
          if (!current) {
            return prev;
          }
          return {
            ...prev,
            [scheduleId]: {
              ...current,
              assignments: current.assignments.map((entry) =>
                entry.assignmentId === assignmentId
                  ? {
                      ...entry,
                      memberId: updated?.member_id ?? null,
                      memberName: resolveMemberLabel(updated?.member_id ?? null, entry.ministryId),
                      member: resolveMemberLabel(updated?.member_id ?? null, entry.ministryId),
                      isPlaceholder: Boolean(updated?.is_placeholder),
                      placeholderReason: updated?.placeholder_reason ?? null
                    }
                  : entry
              )
            }
          };
        });
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: { type: "success", message: "Escala atualizada com sucesso." }
        }));
      } catch (caught) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message:
              caught instanceof Error
                ? caught.message
                : "Erro ao atualizar o assignment selecionado."
          }
        }));
      } finally {
        setAssignmentSaving((prev) => ({ ...prev, [assignmentId]: false }));
      }
    },
    [assignmentDrafts, resolveMemberLabel, scheduleDetails]
  );

  const handleAssignmentPlaceholder = useCallback(
    async (scheduleId: string, assignmentId: string) => {
      const detail = scheduleDetails[scheduleId];
      if (!detail) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message: "Carregue as celebracoes antes de ajustar a escala."
          }
        }));
        return;
      }
      const currentAssignment = detail.assignments.find(
        (assignment) => assignment.assignmentId === assignmentId
      );
      if (!currentAssignment) {
        return;
      }
      const reason = assignmentDrafts[assignmentId]?.placeholderReason?.trim() ?? "";
      setAssignmentSaving((prev) => ({ ...prev, [assignmentId]: true }));
      setManualAlerts((prev) => ({ ...prev, [scheduleId]: null }));
      try {
        const response = await fetch("/api/assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, memberId: null, placeholderReason: reason })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel atualizar a escala.");
        }
        const updated = json.assignment;
        setScheduleDetails((prev) => {
          const current = prev[scheduleId];
          if (!current) {
            return prev;
          }
          return {
            ...prev,
            [scheduleId]: {
              ...current,
              assignments: current.assignments.map((entry) =>
                entry.assignmentId === assignmentId
                  ? {
                      ...entry,
                      memberId: null,
                      memberName: null,
                      member: updated?.placeholder_reason
                        ? `PENDENTE (${updated.placeholder_reason})`
                        : "PENDENTE",
                      isPlaceholder: true,
                      placeholderReason: (updated?.placeholder_reason ?? reason) || null
                    }
                  : entry
              )
            }
          };
        });
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: { type: "success", message: "Assignment marcado como pendente." }
        }));
      } catch (caught) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message:
              caught instanceof Error
                ? caught.message
                : "Erro ao marcar assignment como pendente."
          }
        }));
      } finally {
        setAssignmentSaving((prev) => ({ ...prev, [assignmentId]: false }));
      }
    },
    [assignmentDrafts, scheduleDetails]
  );

  const handleManualAvailability = useCallback(
    async (
      scheduleId: string,
      celebrationId: string | null | undefined,
      ministryId: string | null | undefined,
      available: boolean
    ) => {
      if (!celebrationId) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message: "Selecione uma celebracao valida para registrar disponibilidade."
          }
        }));
        return;
      }
      const key = buildAvailabilityKey(celebrationId, ministryId);
      const memberId = availabilityDrafts[key];
      if (!memberId) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message: "Escolha um membro antes de registrar disponibilidade manual."
          }
        }));
        return;
      }
      setAvailabilitySaving((prev) => ({ ...prev, [key]: true }));
      setManualAlerts((prev) => ({ ...prev, [scheduleId]: null }));
      try {
        const response = await fetch("/api/availabilities/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ celebrationId, memberId, available })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel registrar a disponibilidade.");
        }
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "success",
            message: "Disponibilidade registrada com sucesso."
          }
        }));
      } catch (caught) {
        setManualAlerts((prev) => ({
          ...prev,
          [scheduleId]: {
            type: "error",
            message:
              caught instanceof Error
                ? caught.message
                : "Erro ao registrar disponibilidade manual."
          }
        }));
      } finally {
        setAvailabilitySaving((prev) => ({ ...prev, [key]: false }));
      }
    },
    [availabilityDrafts, buildAvailabilityKey]
  );
    return (
      <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/80">Governanca ministerial</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">Escalas & equipes</h1>
              <p className="mt-4 max-w-2xl text-sm text-sky-100/80">
                Controle completo de escalas mensais: gere novas versoes, publique para a igreja e exporte
                materiais personalizados para cada equipe.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-sky-100/80">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
              >
                Voltar ao painel
              </Link>
              <span className="rounded-full border border-sky-200/30 bg-sky-500/20 px-4 py-2 font-semibold text-sky-100">
                Organizacao que inspira confianca
              </span>
            </div>
          </div>
        </header>

        {(error || success) && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
            {error && <p className="text-rose-200">Aviso: {error}</p>}
            {success && <p className="text-emerald-200">Sucesso: {success}</p>}
          </div>
        )}


        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Gerar nova escala</h2>
              <p className="mt-2 text-sm text-sky-100/80">
                Escolha o mes desejado no formato ano-mes e gere uma nova escala baseada nas
                disponibilidades atuais.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center">
              <label className="flex flex-col gap-2 text-sky-100/80">
                Mes (YYYY-MM)
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
              <button
                type="button"
                disabled={
                  loadingGenerate || loadingRegenerate || !month || Boolean(existingScheduleForSelection)
                }
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
              >
                {loadingGenerate ? 'Processando...' : 'Gerar escala'}
              </button>
              <button
                type="button"
                disabled={
                  loadingGenerate || loadingRegenerate || !month || !existingScheduleForSelection
                }
                onClick={handleRegenerate}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-rose-100/60"
              >
                {loadingRegenerate ? 'Processando...' : 'Apagar e gerar nova'}
              </button>
            </div>
            {existingScheduleForSelection && (
              <p className="rounded-2xl border border-indigo-300/20 bg-indigo-500/10 p-3 text-xs text-sky-100/80">
                Ja existe uma escala {existingScheduleForSelection.status === 'published' ? 'publicada' : 'em rascunho'} para este periodo.
                Use o botao de apagar para gerar uma nova versao.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-white">Escalas cadastradas</h2>
            <p className="text-sm text-sky-100/80">
              Organizadas por ano. Publique quando estiver tudo validado com as liderancas.
            </p>
          </div>

          <div className="mt-6 space-y-8">
            {Object.keys(groupedByYear).length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-sm text-sky-100/70">
                Ainda nao existe nenhuma escala. Gere a primeira usando o formulario acima.
              </div>
            )}

            {Object.entries(groupedByYear)
              .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
              .map(([year, items]) => (
                <div key={year} className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Ano {year}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {items
                      .slice()
                      .sort((a, b) => b.month - a.month)
                      .map((schedule) => {
                        const label = `${String(schedule.month).padStart(2, '0')}/${schedule.year}`;
                        const statusStyle =
                          statusStyles[schedule.status] ??
                          'bg-white/10 text-slate-100 border-white/20';
                        const feedbackItems = feedbackBySchedule[schedule.id] ?? [];
                        const draft =
                          feedbackDraft[schedule.id] ?? {
                            comment: '',
                            category: 'other' as const,
                            severity: 'medium' as const
                          };
                        const manualGroups = getManualCelebrations(schedule.id)
                          .map((group) => ({
                            ...group,
                            ministries: group.ministries.filter((ministry) =>
                              canManageMinistryLocally(ministry.ministryId)
                            )
                          }))
                          .filter((group) => group.ministries.length > 0);
                        return (
                          <article
                            key={schedule.id}
                            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40 transition hover:border-indigo-200/40"
                          >
                            <header className="flex flex-col gap-2">
                              <p className="text-xs uppercase tracking-widest text-sky-200/70">
                                Escala mensal
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <h4 className="text-xl font-semibold text-white">{label}</h4>
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyle}`}
                                >
                                  {schedule.status === 'published' ? 'Publicada' : 'Rascunho'}
                                </span>
                              </div>
                            </header>

                            <div className="flex flex-wrap gap-3 text-xs text-sky-100/70">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                ID - {schedule.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Referencia: {label}
                              </span>
                            </div>

                            <footer className="mt-2 flex flex-wrap items-center gap-3">
                              {schedule.status === 'draft' && (
                                <button
                                  type="button"
                                  onClick={() => publish(schedule.id)}
                                  disabled={loadingPublish === schedule.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                                >
                                  {loadingPublish === schedule.id ? 'Publicando...' : 'Publicar escala'}
                                </button>
                              )}
                              <a
                                href={`/api/schedules/${schedule.id}?format=csv`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/20"
                              >
                                Exportar CSV
                              </a>
                              <a
                                href={`/api/schedules/${schedule.id}?format=pdf`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/20"
                              >
                                Exportar PDF completo
                              </a>
                              <button
                                type="button"
                                onClick={() => toggleCelebrations(schedule.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/40 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:bg-indigo-500/60"
                              >
                                {expandedScheduleId === schedule.id
                                  ? "Ocultar celebracoes"
                                  : "PDF por celebracao"}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFeedback(schedule.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/50"
                              >
                                {feedbackExpandedId === schedule.id
                                  ? 'Ocultar feedback'
                                  : 'Feedback dos lideres'}
                              </button>
                            </footer>
                            {expandedScheduleId === schedule.id && (
                              <>
                                <div className="mt-3 w-full rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-4 text-xs text-sky-100/80 sm:text-sm">
                                  {loadingCelebrations[schedule.id] ? (
                                    <p>Carregando celebracoes...</p>
                                  ) : celebrationsError[schedule.id] ? (
                                    <p className="text-rose-200">{celebrationsError[schedule.id]}</p>
                                  ) : (scheduleCelebrations[schedule.id] ?? []).length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                      {scheduleCelebrations[schedule.id].map((celebration) => (
                                        <a
                                          key={celebration.id}
                                          href={`/api/schedules/${schedule.id}?format=pdf&celebrationId=${celebration.id}`}
                                          className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 transition hover:bg-white/20"
                                        >
                                          <span className="text-sm font-semibold text-white">
                                            {celebration.title}
                                          </span>
                                          <span>{celebration.dateLabel}</span>
                                          <span className="text-xs text-sky-100/70">
                                            {celebration.location
                                              ? `Local: ${celebration.location}`
                                              : "Local nao informado"}
                                          </span>
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>Nenhuma celebracao encontrada para esta escala.</p>
                                  )}
                                </div>
                                {canManageSchedules && (
                                  <div className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-sky-100/80 sm:text-sm">
                                    <div className="flex flex-col gap-1">
                                      <p className="text-sm font-semibold text-white">
                                        Ajustes manuais
                                      </p>
                                      <p className="text-[11px] text-sky-100/70">
                                        Atualize atribuicoes e disponibilidades sem depender apenas das
                                        respostas automaticas dos membros.
                                      </p>
                                    </div>
                                    {manualAlerts[schedule.id] && (
                                      <p
                                        className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                                          manualAlerts[schedule.id]?.type === "success"
                                            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                            : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                                        }`}
                                      >
                                        {manualAlerts[schedule.id]?.message}
                                      </p>
                                    )}
                                    {managerLoading ? (
                                      <p className="mt-3 text-xs text-sky-100/70">
                                        Verificando suas permissoes...
                                      </p>
                                    ) : managerError ? (
                                      <p className="mt-3 text-xs text-rose-200">{managerError}</p>
                                    ) : loadingCelebrations[schedule.id] ? (
                                      <p className="mt-3 text-xs text-sky-100/70">
                                        Carregando detalhes da escala...
                                      </p>
                                    ) : ministryDirectoryLoading ? (
                                      <p className="mt-3 text-xs text-sky-100/70">
                                        Carregando lista de ministerios...
                                      </p>
                                    ) : ministryDirectoryError ? (
                                      <p className="mt-3 text-xs text-rose-200">
                                        {ministryDirectoryError}
                                      </p>
                                    ) : !scheduleDetails[schedule.id] ? (
                                      <p className="mt-3 text-xs text-sky-100/70">
                                        Expanda uma celebracao para carregar os dados antes de editar.
                                      </p>
                                    ) : manualGroups.length === 0 ? (
                                      <p className="mt-3 text-xs text-sky-100/70">
                                        Nenhum ministerio deste periodo esta sob sua lideranca. Caso
                                        precise ajustar outros ministerios, fale com a administracao.
                                      </p>
                                    ) : (
                                      <div className="mt-4 space-y-4">
                                        {manualGroups.map((celebration) => {
                                          const celebrationDate = celebration.date
                                            ? new Date(celebration.date).toLocaleString("pt-BR", {
                                                dateStyle: "full",
                                                timeStyle: "short"
                                              })
                                            : "Data a definir";
                                          return (
                                            <div
                                              key={celebration.id}
                                              className="rounded-xl border border-white/10 bg-slate-950/30 p-4"
                                            >
                                              <div className="flex flex-col gap-1 text-xs text-sky-100/70">
                                                <p className="text-sm font-semibold text-white">
                                                  {celebrationDate}
                                                </p>
                                                {celebration.location && (
                                                  <span>Local: {celebration.location}</span>
                                                )}
                                                {celebration.notes && (
                                                  <span>Notas: {celebration.notes}</span>
                                                )}
                                              </div>
                                              <div className="mt-3 space-y-4">
                                                {celebration.ministries.map((ministry) => {
                                                  const directory =
                                                    ministry.ministryId &&
                                                    ministryDirectory[ministry.ministryId];
                                                  return (
                                                    <div
                                                      key={`${celebration.id}-${ministry.ministryId ?? "unknown"}`}
                                                      className="rounded-xl border border-white/10 bg-slate-900/70 p-3"
                                                    >
                                                      <div className="flex flex-col gap-1">
                                                        <p className="text-sm font-semibold text-white">
                                                          {ministry.ministryName}
                                                        </p>
                                                        <span className="text-[11px] text-sky-100/60">
                                                          {directory?.members.length
                                                            ? `${directory.members.length} membros vinculados`
                                                            : "Nenhum membro carregado para este ministerio."}
                                                        </span>
                                                      </div>
                                                      <div className="mt-3 space-y-3">
                                                        {ministry.assignments.map((assignment) => (
                                                          <div
                                                            key={assignment.assignmentId}
                                                            className="rounded-lg border border-white/10 bg-white/5 p-3"
                                                          >
                                                            <div className="flex flex-col gap-1 text-xs text-sky-100/70">
                                                              <span className="text-sm font-semibold text-white">
                                                                {assignment.role ?? "Funcao"}
                                                              </span>
                                                              <span>
                                                                Atual:{" "}
                                                                {assignment.isPlaceholder
                                                                  ? assignment.placeholderReason
                                                                    ? `PENDENTE (${assignment.placeholderReason})`
                                                                    : "PENDENTE"
                                                                  : assignment.memberName ?? assignment.member ?? "Sem voluntario"}
                                                              </span>
                                                            </div>
                                                            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                                                              <select
                                                                value={
                                                                  assignmentDrafts[assignment.assignmentId]?.memberId ??
                                                                  assignment.memberId ??
                                                                  ""
                                                                }
                                                                onChange={(event) =>
                                                                  setAssignmentDrafts((prev) => ({
                                                                    ...prev,
                                                                    [assignment.assignmentId]: {
                                                                      ...(prev[assignment.assignmentId] ?? {}),
                                                                      memberId: event.target.value
                                                                    }
                                                                  }))
                                                                }
                                                                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                                              >
                                                                <option value="">
                                                                  Selecione um voluntario
                                                                </option>
                                                                {directory?.members.map((member) => (
                                                                  <option key={member.userId} value={member.userId}>
                                                                    {member.name}
                                                                  </option>
                                                                ))}
                                                              </select>
                                                              <button
                                                                type="button"
                                                                disabled={assignmentSaving[assignment.assignmentId]}
                                                                onClick={() =>
                                                                  handleAssignmentSave(schedule.id, assignment.assignmentId)
                                                                }
                                                                className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                                                              >
                                                                {assignmentSaving[assignment.assignmentId]
                                                                  ? "Salvando..."
                                                                  : "Salvar"}
                                                              </button>
                                                            </div>
                                                            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                                                              <input
                                                                type="text"
                                                                value={
                                                                  assignmentDrafts[assignment.assignmentId]?.placeholderReason ?? ""
                                                                }
                                                                onChange={(event) =>
                                                                  setAssignmentDrafts((prev) => ({
                                                                    ...prev,
                                                                    [assignment.assignmentId]: {
                                                                      ...(prev[assignment.assignmentId] ?? {}),
                                                                      placeholderReason: event.target.value
                                                                    }
                                                                  }))
                                                                }
                                                                placeholder="Motivo opcional (ex: aguardando confirmacao)"
                                                                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                                              />
                                                              <button
                                                                type="button"
                                                                disabled={assignmentSaving[assignment.assignmentId]}
                                                                onClick={() =>
                                                                  handleAssignmentPlaceholder(
                                                                    schedule.id,
                                                                    assignment.assignmentId
                                                                  )
                                                                }
                                                                className="inline-flex items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-amber-100/60"
                                                              >
                                                                {assignmentSaving[assignment.assignmentId]
                                                                  ? "Atualizando..."
                                                                  : "Marcar pendente"}
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-100/80">
                                                          Disponibilidade manual
                                                        </p>
                                                        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                                                          <select
                                                            value={
                                                              availabilityDrafts[
                                                                buildAvailabilityKey(
                                                                  celebration.id,
                                                                  ministry.ministryId
                                                                )
                                                              ] ?? ""
                                                            }
                                                            onChange={(event) =>
                                                              setAvailabilityDrafts((prev) => ({
                                                                ...prev,
                                                                [buildAvailabilityKey(
                                                                  celebration.id,
                                                                  ministry.ministryId
                                                                )]: event.target.value
                                                              }))
                                                            }
                                                            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                                          >
                                                            <option value="">
                                                              Escolha o membro para registrar manualmente
                                                            </option>
                                                            {directory?.members.map((member) => (
                                                              <option key={member.userId} value={member.userId}>
                                                                {member.name}
                                                              </option>
                                                            ))}
                                                          </select>
                                                          <div className="flex flex-wrap gap-2">
                                                            <button
                                                              type="button"
                                                              disabled={
                                                                availabilitySaving[
                                                                  buildAvailabilityKey(
                                                                    celebration.id,
                                                                    ministry.ministryId
                                                                  )
                                                                ]
                                                              }
                                                              onClick={() =>
                                                                handleManualAvailability(
                                                                  schedule.id,
                                                                  celebration.id,
                                                                  ministry.ministryId,
                                                                  true
                                                                )
                                                              }
                                                              className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                                                            >
                                                              {availabilitySaving[
                                                                buildAvailabilityKey(
                                                                  celebration.id,
                                                                  ministry.ministryId
                                                                )
                                                              ]
                                                                ? "Enviando..."
                                                                : "Disponivel"}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              disabled={
                                                                availabilitySaving[
                                                                  buildAvailabilityKey(
                                                                    celebration.id,
                                                                    ministry.ministryId
                                                                  )
                                                                ]
                                                              }
                                                              onClick={() =>
                                                                handleManualAvailability(
                                                                  schedule.id,
                                                                  celebration.id,
                                                                  ministry.ministryId,
                                                                  false
                                                                )
                                                              }
                                                              className="inline-flex items-center justify-center rounded-full border border-rose-300/40 bg-rose-500/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-rose-100/60"
                                                            >
                                                              {availabilitySaving[
                                                                buildAvailabilityKey(
                                                                  celebration.id,
                                                                  ministry.ministryId
                                                                )
                                                              ]
                                                                ? "Enviando..."
                                                                : "Indisponivel"}
                                                            </button>
                                                          </div>
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-sky-100/60">
                                                          Use esta opcao quando um membro confirma ou rejeita fora do
                                                          painel (ex: telefone ou conversa presencial).
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            {feedbackExpandedId === schedule.id && (
                              <div className="mt-3 w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-xs text-emerald-100/80 sm:text-sm">
                                {feedbackLoading[schedule.id] ? (
                                  <p>Carregando feedback...</p>
                                ) : feedbackError[schedule.id] ? (
                                  <p className="text-rose-200">{feedbackError[schedule.id]}</p>
                                ) : (
                                  <>
                                    <div className="flex flex-col gap-3">
                                      {feedbackItems.length > 0 ? (
                                        feedbackItems.map((item: any) => (
                                          <div
                                            key={item.id}
                                            className="rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-emerald-100/70">
                                              <span>{(item.category ?? 'other').toUpperCase()}</span>
                                              <span>{(item.severity ?? 'medium').toUpperCase()}</span>
                                            </div>
                                            <p className="text-sm text-white">{item.comment}</p>
                                            <span className="text-[10px] text-emerald-100/60">
                                              Registrado em{' '}
                                              {item.created_at
                                                ? new Date(item.created_at).toLocaleString('pt-BR', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                  })
                                                : 'data desconhecida'}
                                            </span>
                                          </div>
                                        ))
                                      ) : (
                                        <p>Nenhum feedback registrado ainda.</p>
                                      )}
                                    </div>
                                    <form
                                      className="mt-4 flex flex-col gap-3"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        submitFeedback(schedule.id);
                                      }}
                                    >
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide">
                                          Categoria
                                          <select
                                            value={draft.category}
                                            onChange={(event) =>
                                              setFeedbackDraft((prev) => ({
                                                ...prev,
                                                [schedule.id]: {
                                                  ...(prev[schedule.id] ?? draft),
                                                  comment: prev[schedule.id]?.comment ?? draft.comment,
                                                  category: event.target.value as typeof draft.category
                                                }
                                              }))
                                            }
                                            className="rounded-lg border border-emerald-300/30 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                          >
                                            <option value="availability">Disponibilidade</option>
                                            <option value="competency">Competencia</option>
                                            <option value="preference">Preferencia</option>
                                            <option value="fairness">Equidade</option>
                                            <option value="other">Outro</option>
                                          </select>
                                        </label>
                                        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide">
                                          Severidade
                                          <select
                                            value={draft.severity}
                                            onChange={(event) =>
                                              setFeedbackDraft((prev) => ({
                                                ...prev,
                                                [schedule.id]: {
                                                  ...(prev[schedule.id] ?? draft),
                                                  comment: prev[schedule.id]?.comment ?? draft.comment,
                                                  severity: event.target.value as typeof draft.severity
                                                }
                                              }))
                                            }
                                            className="rounded-lg border border-emerald-300/30 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                          >
                                            <option value="low">Baixa</option>
                                            <option value="medium">Media</option>
                                            <option value="high">Alta</option>
                                            <option value="critical">Critica</option>
                                          </select>
                                        </label>
                                      </div>
                                      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide">
                                        Comentario
                                        <textarea
                                          value={draft.comment}
                                          onChange={(event) =>
                                            setFeedbackDraft((prev) => ({
                                              ...prev,
                                              [schedule.id]: {
                                                ...(prev[schedule.id] ?? draft),
                                                comment: event.target.value
                                              }
                                            }))
                                          }
                                          rows={3}
                                          placeholder="Descreva o ajuste desejado ou o problema encontrado."
                                          className="min-h-[90px] rounded-lg border border-emerald-300/30 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                        />
                                      </label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="submit"
                                          disabled={feedbackSubmitting[schedule.id]}
                                          className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/70 px-4 py-2 text-sm font-semibold text-white shadow shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                                        >
                                          {feedbackSubmitting[schedule.id] ? 'Enviando...' : 'Enviar feedback'}
                                        </button>
                                        <span className="text-[11px] text-emerald-100/70">
                                          Compartilhe com a equipe de planejamento onde ajustes sao necessarios.
                                        </span>
                                      </div>
                                    </form>
                                  </>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
