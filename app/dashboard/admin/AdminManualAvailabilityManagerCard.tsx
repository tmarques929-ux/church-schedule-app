"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MinistryResponse = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  members: Array<{
    userId: string;
    name: string | null;
    username: string | null;
    role: string | null;
  }>;
};

type CelebrationOption = {
  id: string;
  label: string;
};

type MemberAssignmentsState = {
  loading: boolean;
  error: string | null;
  ministryIds: string[];
  leaderMinistryIds: string[];
};

type AvailabilityFeedback = {
  type: "success" | "error";
  message: string;
};

export default function AdminManualAvailabilityManagerCard() {
  const [ministries, setMinistries] = useState<MinistryResponse[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("");
  const [loadingMinistries, setLoadingMinistries] = useState(false);
  const [ministriesError, setMinistriesError] = useState<string | null>(null);

  const [celebrations, setCelebrations] = useState<CelebrationOption[]>([]);
  const [celebrationsLoading, setCelebrationsLoading] = useState(false);
  const [celebrationsError, setCelebrationsError] = useState<string | null>(null);

  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [memberAssignments, setMemberAssignments] = useState<Record<string, MemberAssignmentsState>>({});
  const [assignmentSaving, setAssignmentSaving] = useState<Record<string, boolean>>({});

  const [celebrationSelections, setCelebrationSelections] = useState<Record<string, string>>({});
  const [availabilitySaving, setAvailabilitySaving] = useState<Record<string, boolean>>({});
  const [availabilityFeedback, setAvailabilityFeedback] = useState<Record<string, AvailabilityFeedback | null>>({});
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  useEffect(() => {
    async function loadMinistries() {
      setLoadingMinistries(true);
      setMinistriesError(null);
      try {
        const response = await fetch("/api/ministries?includeMembers=true");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar ministerios.");
        }
        const entries: MinistryResponse[] = Array.isArray(json.ministries) ? json.ministries : [];
        setMinistries(entries);
        if (entries.length > 0) {
          setSelectedMinistryId((current) => current || entries[0].id);
        }
      } catch (err) {
        setMinistriesError(err instanceof Error ? err.message : "Erro ao buscar ministerios.");
        setMinistries([]);
      } finally {
        setLoadingMinistries(false);
      }
    }
    loadMinistries();
  }, []);

  useEffect(() => {
    async function loadCelebrations() {
      setCelebrationsLoading(true);
      setCelebrationsError(null);
      try {
        const response = await fetch("/api/availabilities/admin?includePast=false&limit=50");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar celebracoes.");
        }
        const options: CelebrationOption[] = Array.isArray(json.celebrations)
          ? json.celebrations.map((item: any) => ({
              id: item.id,
              label: item.starts_at
                ? new Date(item.starts_at).toLocaleString("pt-BR", {
                    dateStyle: "full",
                    timeStyle: "short"
                  })
                : "Data a definir"
            }))
          : [];
        setCelebrations(options);
      } catch (err) {
        setCelebrationsError(
          err instanceof Error ? err.message : "Erro inesperado ao carregar celebracoes."
        );
        setCelebrations([]);
      } finally {
        setCelebrationsLoading(false);
      }
    }
    loadCelebrations();
  }, []);

  const selectedMinistry = useMemo(
    () => ministries.find((entry) => entry.id === selectedMinistryId) ?? null,
    [ministries, selectedMinistryId]
  );

  useEffect(() => {
    if (!selectedMinistry && ministries.length > 0) {
      setSelectedMinistryId(ministries[0].id);
    }
  }, [ministries, selectedMinistry]);

  const allMinistryOptions = useMemo(
    () =>
      ministries.map((entry) => ({
        id: entry.id,
        label: entry.name
      })),
    [ministries]
  );

  const allMembers = useMemo(() => {
    const map = new Map<string, { userId: string; name: string | null; username: string | null }>();
    ministries.forEach((ministry) => {
      ministry.members.forEach((member) => {
        if (!map.has(member.userId)) {
          map.set(member.userId, {
            userId: member.userId,
            name: member.name,
            username: member.username
          });
        }
      });
    });
    return Array.from(map.values());
  }, [ministries]);

  const searchedMembers = useMemo(() => {
    const term = memberSearchTerm.trim().toLowerCase();
    if (term.length < 2) {
      return [];
    }
    return allMembers.filter((member) => {
      const name = member.name?.toLowerCase() ?? "";
      const username = member.username?.toLowerCase() ?? "";
      return name.includes(term) || username.includes(term);
    });
  }, [allMembers, memberSearchTerm]);

  const loadMemberAssignments = useCallback(async (memberId: string) => {
    setMemberAssignments((prev) => ({
      ...prev,
      [memberId]: { loading: true, error: null, ministryIds: [], leaderMinistryIds: [] }
    }));
    try {
      const response = await fetch(`/api/member-ministries?userId=${memberId}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel carregar ministerios do membro.");
      }
      const assignments = Array.isArray(json.assignments) ? json.assignments : [];
      setMemberAssignments((prev) => ({
        ...prev,
        [memberId]: {
          loading: false,
          error: null,
          ministryIds: assignments.map((item: any) => item.ministryId),
          leaderMinistryIds: assignments.filter((item: any) => item.isLeader).map((item: any) => item.ministryId)
        }
      }));
    } catch (err) {
      setMemberAssignments((prev) => ({
        ...prev,
        [memberId]: {
          loading: false,
          error: err instanceof Error ? err.message : "Erro ao carregar ministerios.",
          ministryIds: [],
          leaderMinistryIds: []
        }
      }));
    }
  }, []);

  const ensureMemberAssignmentsLoaded = useCallback(
    (memberId: string) => {
      const current = memberAssignments[memberId];
      if (!current || current.error) {
        loadMemberAssignments(memberId);
      }
    },
    [loadMemberAssignments, memberAssignments]
  );

  const loadMinistriesForRefresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ministries?includeMembers=true");
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error);
      }
      const entries: MinistryResponse[] = Array.isArray(json.ministries) ? json.ministries : [];
      setMinistries(entries);
    } catch {
      // silencioso
    }
  }, []);

  const updateMemberAssignments = useCallback(
    async (memberId: string) => {
      const current = memberAssignments[memberId];
      if (!current || current.loading) return;
      setAssignmentSaving((prev) => ({ ...prev, [memberId]: true }));
      try {
        const payload = {
          userId: memberId,
          ministryIds: current.ministryIds,
          leaderMinistryIds: current.leaderMinistryIds
        };
        const response = await fetch("/api/member-ministries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel atualizar ministerios.");
        }
        await loadMinistriesForRefresh();
      } catch (err) {
        setMemberAssignments((prev) => ({
          ...prev,
          [memberId]: {
            ...(prev[memberId] ?? { ministryIds: [], leaderMinistryIds: [], loading: false, error: null }),
            error: err instanceof Error ? err.message : "Erro ao salvar ministerios."
          }
        }));
      } finally {
        setAssignmentSaving((prev) => ({ ...prev, [memberId]: false }));
      }
    },
    [memberAssignments, loadMinistriesForRefresh]
  );

  const handleAvailabilityUpdate = useCallback(
    async (memberId: string, available: boolean) => {
      const celebrationId =
        celebrationSelections[memberId] || celebrations[0]?.id || null;
      if (!celebrationId) {
        setAvailabilityFeedback((prev) => ({
          ...prev,
          [memberId]: { type: "error", message: "Selecione uma celebracao valida." }
        }));
        return;
      }
      setAvailabilitySaving((prev) => ({ ...prev, [memberId]: true }));
      setAvailabilityFeedback((prev) => ({ ...prev, [memberId]: null }));
      try {
        const response = await fetch("/api/availabilities/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ celebrationId, memberId, available })
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel registrar disponibilidade.");
        }
        setAvailabilityFeedback((prev) => ({
          ...prev,
          [memberId]: {
            type: "success",
            message: available ? "Disponibilidade confirmada." : "Membro marcado como indisponivel."
          }
        }));
      } catch (err) {
        setAvailabilityFeedback((prev) => ({
          ...prev,
          [memberId]: {
            type: "error",
            message: err instanceof Error ? err.message : "Erro ao atualizar disponibilidade."
          }
        }));
      } finally {
        setAvailabilitySaving((prev) => ({ ...prev, [memberId]: false }));
      }
    },
    [celebrationSelections, celebrations]
  );

  const handleMinistryCheckboxChange = useCallback(
    (memberId: string, ministryId: string, checked: boolean) => {
      setMemberAssignments((prev) => {
        const current = prev[memberId];
        if (!current) return prev;
        const nextMinistryIds = checked
          ? [...new Set([...current.ministryIds, ministryId])]
          : current.ministryIds.filter((id) => id !== ministryId);
        const nextLeaderIds = checked
          ? current.leaderMinistryIds
          : current.leaderMinistryIds.filter((id) => id !== ministryId);
        return {
          ...prev,
          [memberId]: {
            ...current,
            ministryIds: nextMinistryIds,
            leaderMinistryIds: nextLeaderIds
          }
        };
      });
    },
    []
  );

  const handleLeaderCheckboxChange = useCallback((memberId: string, ministryId: string, checked: boolean) => {
    setMemberAssignments((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      const nextLeaderIds = checked
        ? [...new Set([...current.leaderMinistryIds, ministryId])]
        : current.leaderMinistryIds.filter((id) => id !== ministryId);
      return {
        ...prev,
        [memberId]: {
          ...current,
          leaderMinistryIds: nextLeaderIds
        }
      };
    });
  }, []);

  const handleCelebrationSelection = useCallback((memberId: string, celebrationId: string) => {
    setCelebrationSelections((prev) => ({
      ...prev,
      [memberId]: celebrationId
    }));
  }, []);

  const renderMemberCard = useCallback(
    (member: { userId: string; name: string | null; username: string | null }, keyPrefix: string) => {
      const expanded = expandedMembers[member.userId] ?? false;
      const assignmentState = memberAssignments[member.userId];
      const celebrationSelection =
        celebrationSelections[member.userId] || celebrations[0]?.id || "";
      const feedback = availabilityFeedback[member.userId];
      return (
        <article
          key={`${keyPrefix}-${member.userId}`}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-inner shadow-black/40"
        >
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {member.name ?? member.username ?? "Voluntario"}
              </h3>
              <p className="text-xs text-indigo-100/70">{member.username ?? "sem-username"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setExpandedMembers((prev) => ({
                  ...prev,
                  [member.userId]: !expanded
                }));
                if (!expanded) {
                  ensureMemberAssignmentsLoaded(member.userId);
                }
              }}
              className="self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-100 transition hover:bg-white/20"
            >
              {expanded ? "Recolher" : "Gerenciar"}
            </button>
          </header>

          {expanded && (
            <div className="mt-4 space-y-6">
              <div>
                <p className="text-sm font-semibold text-white">Vinculos ministeriais</p>
                {assignmentState?.error && (
                  <p className="mt-2 rounded-lg border border-rose-300/30 bg-rose-500/20 px-3 py-2 text-xs text-rose-100">
                    {assignmentState.error}
                  </p>
                )}
                {!assignmentState || assignmentState.loading ? (
                  <p className="mt-2 text-xs text-indigo-100/70">
                    Carregando informacoes de vinculo...
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {allMinistryOptions.map((option) => {
                      const checked = assignmentState.ministryIds.includes(option.id);
                      const leaderChecked = assignmentState.leaderMinistryIds.includes(option.id);
                      return (
                        <div
                          key={`${member.userId}-${option.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-indigo-100/80"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-white/20 bg-slate-950/80"
                              checked={checked}
                              onChange={(event) =>
                                handleMinistryCheckboxChange(member.userId, option.id, event.target.checked)
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                          {checked && (
                            <label className="ml-6 mt-1 flex items-center gap-2 text-xs text-indigo-100/70">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-white/20 bg-slate-950/80"
                                checked={leaderChecked}
                                onChange={(event) =>
                                  handleLeaderCheckboxChange(member.userId, option.id, event.target.checked)
                                }
                              />
                              <span>Lideranca</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => updateMemberAssignments(member.userId)}
                      disabled={assignmentSaving[member.userId]}
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
                    >
                      {assignmentSaving[member.userId] ? "Salvando..." : "Salvar vinculos"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Disponibilidade manual</p>
                <label className="mt-2 block text-xs uppercase tracking-[0.3em] text-indigo-200/70">
                  Celebracao
                  <select
                    value={celebrationSelection}
                    onChange={(event) => handleCelebrationSelection(member.userId, event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  >
                    {celebrations.map((celebration) => (
                      <option key={`${member.userId}-${celebration.id}`} value={celebration.id}>
                        {celebration.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={availabilitySaving[member.userId]}
                    onClick={() => handleAvailabilityUpdate(member.userId, true)}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                  >
                    {availabilitySaving[member.userId] ? "Atualizando..." : "Disponivel"}
                  </button>
                  <button
                    type="button"
                    disabled={availabilitySaving[member.userId]}
                    onClick={() => handleAvailabilityUpdate(member.userId, false)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-rose-100/60"
                  >
                    {availabilitySaving[member.userId] ? "Atualizando..." : "Indisponivel"}
                  </button>
                </div>
                {feedback && (
                  <p
                    className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                      feedback.type === "success"
                        ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                        : "border-rose-300/30 bg-rose-500/20 text-rose-100"
                    }`}
                  >
                    {feedback.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </article>
      );
    },
    [
      allMinistryOptions,
      assignmentSaving,
      availabilityFeedback,
      availabilitySaving,
      celebrationSelections,
      celebrations,
      ensureMemberAssignmentsLoaded,
      expandedMembers,
      handleAvailabilityUpdate,
      handleCelebrationSelection,
      handleLeaderCheckboxChange,
      handleMinistryCheckboxChange,
      memberAssignments,
      updateMemberAssignments
    ]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-slate-100 shadow-2xl shadow-black/40">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-200/80">Disponibilidades e ministerios</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Controle manual por ministerio</h2>
        <p className="mt-2 text-sm text-indigo-100/70">
          Escolha um ministerio para visualizar membros, ajustar vinculos e registrar disponibilidades em nome
          do voluntario.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="w-full text-sm text-indigo-100/80">
          <span className="mb-1 block text-xs uppercase tracking-[0.3em] text-indigo-200/70">
            Buscar por membro (min. 2 letras)
          </span>
          <input
            type="search"
            value={memberSearchTerm}
            onChange={(event) => setMemberSearchTerm(event.target.value)}
            placeholder="Digite parte do nome ou username"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow-inner shadow-black/30 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </label>
        <label className="text-sm text-indigo-100/80">
          <span className="mb-1 block text-xs uppercase tracking-[0.3em] text-indigo-200/70">
            Selecionar ministerio
          </span>
          <select
            value={selectedMinistryId}
            onChange={(event) => setSelectedMinistryId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow-inner shadow-black/30 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          >
            {ministries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} {entry.active ? "" : "(inativo)"}
              </option>
            ))}
          </select>
        </label>
        {celebrationsLoading ? (
          <span className="text-xs text-indigo-100/70">Carregando celebracoes...</span>
        ) : celebrationsError ? (
          <span className="text-xs text-rose-200">{celebrationsError}</span>
        ) : celebrations.length === 0 ? (
          <span className="text-xs text-indigo-100/70">Nenhuma celebracao futura encontrada.</span>
        ) : null}
      </div>

      {loadingMinistries && (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/70">
          Carregando ministerios...
        </p>
      )}
      {ministriesError && (
        <p className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
          {ministriesError}
        </p>
      )}

      {memberSearchTerm.trim().length >= 2 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-white">
            Resultados para &quot;{memberSearchTerm.trim()}&quot; ({searchedMembers.length})
          </p>
          {searchedMembers.length === 0 ? (
            <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/70">
              Nenhum membro localizado para este termo.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {searchedMembers.map((member) => renderMemberCard(member, "search"))}
            </div>
          )}
        </div>
      )}

      {selectedMinistry && selectedMinistry.members.length === 0 && (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/70">
          Nenhum membro vinculado a este ministerio.
        </p>
      )}

      {selectedMinistry && selectedMinistry.members.length > 0 && (
        <div className="mt-6 space-y-4">
          {selectedMinistry.members.map((member) =>
            renderMemberCard(
              {
                userId: member.userId,
                name: member.name,
                username: member.username
              },
              `ministry-${selectedMinistry.id}`
            )
          )}
        </div>
      )}
    </section>
  );
}
