"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type MinistryOption = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type UserResult = {
  user_id: string;
  name: string | null;
  username: string | null;
  role: string | null;
};

type AssignmentRecord = {
  ministryId: string;
  isLeader: boolean;
  ministry?: {
    id: string;
    name: string | null;
    description: string | null;
    active: boolean | null;
  };
};

export default function AdminMinistryAssignmentsCard() {
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [ministriesLoading, setMinistriesLoading] = useState(false);
  const [ministriesError, setMinistriesError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [selectedMinistryIds, setSelectedMinistryIds] = useState<string[]>([]);
  const [selectedLeaderMinistryIds, setSelectedLeaderMinistryIds] = useState<string[]>([]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resolveDisplayName = useCallback((name: string | null, username: string | null) => {
    const normalizedUsername = username?.trim().toLowerCase();
    if (normalizedUsername === "thiagomrib") {
      return "Thiago Marques Ribeiro";
    }
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Sem nome cadastrado";
  }, []);

  useEffect(() => {
    async function loadMinistries() {
      setMinistriesLoading(true);
      setMinistriesError(null);
      try {
        const response = await fetch("/api/ministries");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar os ministerios.");
        }
        setMinistries(Array.isArray(json.ministries) ? json.ministries : []);
      } catch (err) {
        setMinistriesError(err instanceof Error ? err.message : "Erro inesperado ao buscar ministerios.");
      } finally {
        setMinistriesLoading(false);
      }
    }
    loadMinistries();
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchError("Digite pelo menos 2 caracteres para buscar.");
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const params = new URLSearchParams({ term, limit: "10" });
      const response = await fetch(`/api/users/search?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel realizar a busca.");
      }
      setSearchResults(Array.isArray(json.results) ? json.results : []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erro inesperado ao buscar usuarios.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadAssignments(user: UserResult) {
    setSelectedUser(user);
    setSaveMessage(null);
    setSaveError(null);
    setSelectedMinistryIds([]);
    setSelectedLeaderMinistryIds([]);
    try {
      const params = new URLSearchParams({ userId: user.user_id });
      const response = await fetch(`/api/member-ministries?${params.toString()}`);
      const json: { assignments?: AssignmentRecord[]; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel carregar os vinculos.");
      }
      const assignments = Array.isArray(json.assignments) ? json.assignments : [];
      setSelectedMinistryIds(assignments.map((item) => item.ministryId));
      setSelectedLeaderMinistryIds(assignments.filter((item) => item.isLeader).map((item) => item.ministryId));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro inesperado ao carregar vinculos.");
    }
  }

  function toggleMinistry(ministryId: string) {
    setSelectedMinistryIds((current) =>
      current.includes(ministryId) ? current.filter((id) => id !== ministryId) : [...current, ministryId]
    );
    setSelectedLeaderMinistryIds((current) => (current.includes(ministryId) ? current.filter((id) => id !== ministryId) : current));
  }

  function toggleLeader(ministryId: string) {
    setSelectedLeaderMinistryIds((current) =>
      current.includes(ministryId) ? current.filter((id) => id !== ministryId) : [...current, ministryId]
    );
    setSelectedMinistryIds((current) => (current.includes(ministryId) ? current : [...current, ministryId]));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) {
      setSaveError("Selecione um usuario antes de salvar.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/member-ministries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.user_id,
          ministryIds: selectedMinistryIds,
          leaderMinistryIds: selectedLeaderMinistryIds
        })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Falha ao atualizar os vinculos do usuario.");
      }
      setSaveMessage("Vinculos atualizados com sucesso.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro inesperado ao salvar vinculos.");
    } finally {
      setSaveLoading(false);
    }
  }

  const ministriesByStatus = useMemo(() => {
    return {
      active: ministries.filter((item) => item.active),
      inactive: ministries.filter((item) => !item.active)
    };
  }, [ministries]);

  function renderMinistryOption(ministry: MinistryOption, inactive: boolean) {
    const checked = selectedMinistryIds.includes(ministry.id);
    const leaderChecked = selectedLeaderMinistryIds.includes(ministry.id);
    return (
      <div
        key={ministry.id}
        className={`rounded-xl border px-4 py-3 ${inactive ? "border-rose-300/30 bg-rose-500/10" : "border-white/10 bg-slate-900/60"}`}
      >
        <label className="flex items-start gap-3 text-sm text-white">
          <input
            type="checkbox"
            className={`mt-1 h-4 w-4 rounded border border-white/30 bg-transparent ${
              inactive ? "text-rose-400 focus:ring-rose-400" : "text-indigo-400 focus:ring-indigo-400"
            }`}
            checked={checked}
            onChange={() => toggleMinistry(ministry.id)}
          />
          <span className="font-semibold">
            {ministry.name}
            {ministry.description && (
              <span className="block text-xs font-normal text-indigo-100/70">{ministry.description}</span>
            )}
            {inactive && <span className="block text-xs font-normal text-rose-200/80">Ministerio inativo</span>}
          </span>
        </label>
        <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-indigo-100/80">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-white/30 bg-transparent text-emerald-400 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              checked={leaderChecked}
              onChange={() => toggleLeader(ministry.id)}
              disabled={!checked}
            />
            <span>{checked ? "Marcar como lider deste ministerio" : "Selecione o ministerio para habilitar a lideranca"}</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Vincular voluntarios a ministerios</h2>
        <p className="text-sm text-indigo-100/80">
          Pesquise um usuario cadastrado e defina em quais ministerios ele serve e quem lidera cada equipe.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex w-full flex-col gap-2 text-sm text-indigo-100/80 md:flex-row md:items-center">
          <span className="md:w-48">Buscar usuario</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            placeholder="Nome ou username"
          />
        </label>
        <button
          type="submit"
          disabled={searchLoading}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
        >
          {searchLoading ? "Buscando..." : "Pesquisar"}
        </button>
      </form>

      {searchError && (
        <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
          {searchError}
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-200/70">Resultados</h3>
          <div className="mt-3 space-y-2 text-sm text-indigo-100/80">
            {searchResults.length === 0 ? (
              <p className="text-xs text-indigo-100/60">Nenhum usuario listado. Utilize o campo de busca.</p>
            ) : (
              searchResults.map((user) => {
                const isSelected = selectedUser?.user_id === user.user_id;
                return (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => loadAssignments(user)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-indigo-300/60 bg-indigo-500/20 text-white"
                        : "border-white/10 bg-slate-900/60 hover:border-indigo-300/40 hover:bg-indigo-500/10"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{resolveDisplayName(user.name, user.username)}</span>
                    <span className="block text-xs text-indigo-100/70">
                      @{user.username ?? "sem-username"} Â· {user.role ?? "MEMBER"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-200/70">Ministerios</h3>

          {ministriesLoading ? (
            <p className="mt-3 text-xs text-indigo-100/60">Carregando ministerios...</p>
          ) : ministriesError ? (
            <p className="mt-3 text-xs text-rose-200/80">{ministriesError}</p>
          ) : !selectedUser ? (
            <p className="mt-3 text-xs text-indigo-100/60">Selecione um usuario para ajustar os ministerios.</p>
          ) : ministries.length === 0 ? (
            <p className="mt-3 text-xs text-indigo-100/60">
              Nenhum ministerio cadastrado. Cadastre um novo na sessao ao lado.
            </p>
          ) : (
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <fieldset className="space-y-3 text-sm text-indigo-100/80">
                {ministriesByStatus.active.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
                      Ativos
                    </h4>
                    <div className="mt-2 space-y-2">
                      {ministriesByStatus.active.map((ministry) => renderMinistryOption(ministry, false))}
                    </div>
                  </div>
                )}

                {ministriesByStatus.inactive.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-rose-200/80">
                      Inativos
                    </h4>
                    <div className="mt-2 space-y-2">
                      {ministriesByStatus.inactive.map((ministry) => renderMinistryOption(ministry, true))}
                    </div>
                  </div>
                )}
              </fieldset>

              <button
                type="submit"
                disabled={saveLoading}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
              >
                {saveLoading ? "Salvando..." : "Atualizar vinculos"}
              </button>

              {saveError && (
                <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
                  {saveError}
                </p>
              )}
              {saveMessage && (
                <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">
                  {saveMessage}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

