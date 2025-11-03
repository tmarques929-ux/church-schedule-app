"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  canManageUsers: boolean;
};

type MinistryOption = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type UserLookup = {
  user_id: string;
  name: string | null;
  username: string | null;
  role: string | null;
  family_id: string | null;
  family_name: string | null;
};

const MIN_FAMILY_SEARCH_LENGTH = 2;
const MIN_FAMILY_NAME_LENGTH = 3;

export default function CreateUserCard({ canManageUsers }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [selectedMinistryIds, setSelectedMinistryIds] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [familySearchTerm, setFamilySearchTerm] = useState("");
  const [familySearchResults, setFamilySearchResults] = useState<UserLookup[]>([]);
  const [familySearchLoading, setFamilySearchLoading] = useState(false);
  const [familySearchError, setFamilySearchError] = useState<string | null>(null);
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<UserLookup[]>([]);
  const [familyName, setFamilyName] = useState("");

  useEffect(() => {
    async function loadMinistries() {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const response = await fetch("/api/ministries");
        const json = await response.json();
        if (!response.ok) {
          setOptionsError(json.error || "Nao foi possivel carregar a lista de ministerios.");
          setMinistries([]);
          return;
        }
        setMinistries(Array.isArray(json.ministries) ? json.ministries : []);
      } catch (err) {
        setOptionsError(err instanceof Error ? err.message : "Erro inesperado ao carregar ministerios.");
        setMinistries([]);
      } finally {
        setOptionsLoading(false);
      }
    }
    loadMinistries();
  }, []);

  const resolveDisplayName = (lookup: UserLookup) => {
    const normalizedUsername = lookup.username?.trim().toLowerCase();
    if (normalizedUsername === "thiagomrib") {
      return "Thiago Marques Ribeiro";
    }
    const trimmed = lookup.name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Sem nome cadastrado";
  };

  const familyInfo = useMemo(() => {
    if (selectedFamilyMembers.length === 0) {
      return {
        hasSelection: false,
        conflict: false,
        existingFamilyId: null as string | null,
        existingFamilyName: "",
        membersWithoutFamily: 0
      };
    }
    const familyIds = new Set<string>();
    let existingFamilyName = "";
    let membersWithoutFamily = 0;
    selectedFamilyMembers.forEach((member) => {
      if (member.family_id) {
        familyIds.add(member.family_id);
        if (!existingFamilyName && member.family_name) {
          existingFamilyName = member.family_name;
        }
      } else {
        membersWithoutFamily += 1;
      }
    });
    return {
      hasSelection: true,
      conflict: familyIds.size > 1,
      existingFamilyId: familyIds.size === 1 ? Array.from(familyIds)[0] : null,
      existingFamilyName,
      membersWithoutFamily
    };
  }, [selectedFamilyMembers]);

  useEffect(() => {
    if (familyInfo.existingFamilyName && !familyName) {
      setFamilyName(familyInfo.existingFamilyName);
    }
  }, [familyInfo.existingFamilyName, familyName]);

  function toggleMinistrySelection(ministryId: string) {
    setSelectedMinistryIds((current) =>
      current.includes(ministryId) ? current.filter((id) => id !== ministryId) : [...current, ministryId]
    );
  }

  async function performFamilySearch() {
    const term = familySearchTerm.trim();
    if (term.length < MIN_FAMILY_SEARCH_LENGTH) {
      setFamilySearchError(`Digite pelo menos ${MIN_FAMILY_SEARCH_LENGTH} caracteres para buscar.`);
      setFamilySearchResults([]);
      return;
    }
    setFamilySearchLoading(true);
    setFamilySearchError(null);
    try {
      const params = new URLSearchParams({ term, limit: "12" });
      const response = await fetch(`/api/users/search?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel realizar a busca.");
      }
      setFamilySearchResults(Array.isArray(json.results) ? json.results : []);
    } catch (err) {
      setFamilySearchError(err instanceof Error ? err.message : "Erro inesperado ao buscar voluntarios.");
      setFamilySearchResults([]);
    } finally {
      setFamilySearchLoading(false);
    }
  }

  function handleAddFamilyMember(candidate: UserLookup) {
    setSelectedFamilyMembers((current) => {
      if (current.some((member) => member.user_id === candidate.user_id)) {
        return current;
      }
      return [...current, candidate];
    });
  }

  function handleRemoveFamilyMember(userId: string) {
    setSelectedFamilyMembers((current) => current.filter((member) => member.user_id !== userId));
  }

  if (!canManageUsers) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (familyInfo.conflict) {
      setError("Os voluntarios selecionados pertencem a familias diferentes. Ajuste o vinculo antes de continuar.");
      setLoading(false);
      return;
    }

    const trimmedFamilyName = familyName.trim();
    const needsFamilyName =
      !familyInfo.existingFamilyId && (selectedFamilyMembers.length > 0 || trimmedFamilyName.length > 0);

    if (needsFamilyName && trimmedFamilyName.length < MIN_FAMILY_NAME_LENGTH) {
      setError(`Informe um nome de familia com pelo menos ${MIN_FAMILY_NAME_LENGTH} caracteres.`);
      setLoading(false);
      return;
    }

    try {
      const familyMemberIds = selectedFamilyMembers.map((member) => member.user_id);
      const payload: Record<string, unknown> = {
        name,
        role,
        username: username.trim().toLowerCase(),
        ministryIds: selectedMinistryIds
      };

      if (familyMemberIds.length > 0 || trimmedFamilyName) {
        payload.family = {
          memberIds: familyMemberIds,
          newFamilyName: trimmedFamilyName || null
        };
      }

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Nao foi possivel criar o usuario.");
      } else {
        setMessage(
          `Usuario criado com sucesso. Senha padrao: ${json.defaultPassword}. Oriente o voluntario a alterar assim que fizer login.`
        );
        setName("");
        setUsername("");
        setRole("MEMBER");
        setSelectedMinistryIds([]);
        setSelectedFamilyMembers([]);
        setFamilySearchResults([]);
        setFamilySearchTerm("");
        setFamilyName("");
        setFamilySearchError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const selectedFamilySet = useMemo(
    () => new Set(selectedFamilyMembers.map((member) => member.user_id)),
    [selectedFamilyMembers]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Cadastro rapido de voluntario</h2>
        <p className="text-sm text-indigo-100/80">
          Crie um acesso com username e senha padrao para novos membros. Eles deverao alterar a senha no primeiro login.
        </p>
      </div>
      {error && <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {message && (
        <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">{message}</p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
          Nome completo
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Username (acesso)
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Papel
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "MEMBER" | "ADMIN")}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          >
            <option value="MEMBER">Membro (acesso padrao)</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-indigo-100/80 md:col-span-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
            Vinculo familiar (opcional)
          </legend>
          <p className="text-xs text-indigo-100/70">
            Busque voluntarios existentes para reaproveitar a familia ou crie uma nova. Todos os selecionados serao
            vinculados com o novo cadastro.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-1 min-w-[220px] flex-col gap-2 text-xs text-indigo-100/80">
              Buscar voluntario
              <input
                type="text"
                value={familySearchTerm}
                onChange={(event) => setFamilySearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    performFamilySearch();
                  }
                }}
                placeholder="Nome ou username"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </label>
            <button
              type="button"
              onClick={performFamilySearch}
              disabled={familySearchLoading}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
            >
              {familySearchLoading ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {familySearchError && (
            <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-xs text-rose-100">{familySearchError}</p>
          )}
          {familySearchResults.length > 0 && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs">
              {familySearchResults.map((user) => {
                const alreadySelected = selectedFamilySet.has(user.user_id);
                return (
                  <div
                    key={user.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">{resolveDisplayName(user)}</span>
                      <span className="text-xs text-indigo-100/70">
                        @{user.username ?? "sem-username"} · {user.role ?? "MEMBER"}
                      </span>
                      <span className="text-xs text-indigo-100/60">
                        Familia: {user.family_name ?? "Sem familia vinculada"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddFamilyMember(user)}
                      disabled={alreadySelected}
                      className="rounded-full border border-indigo-300/40 bg-indigo-500/80 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
                    >
                      {alreadySelected ? "Adicionada" : "Adicionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {selectedFamilyMembers.length > 0 && (
            <div className="space-y-2 rounded-xl border border-indigo-300/30 bg-indigo-500/10 p-3 text-xs text-indigo-100/80">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200/80">Familiares selecionados</p>
              {selectedFamilyMembers.map((member) => (
                <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{resolveDisplayName(member)}</span>
                    <span className="text-xs text-indigo-100/70">
                      @{member.username ?? "sem-username"} · {member.role ?? "MEMBER"}
                    </span>
                    <span className="text-xs text-indigo-100/60">
                      Familia atual: {member.family_name ?? "Sem familia vinculada"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFamilyMember(member.user_id)}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100 transition hover:bg-white/20"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
          {familyInfo.conflict && (
            <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-xs text-rose-100">
              Os voluntarios selecionados pertencem a familias diferentes. Remova ou ajuste os vinculos antes de criar o novo membro.
            </p>
          )}
          {!familyInfo.existingFamilyId && (
            <label className="flex flex-col gap-2 text-xs text-indigo-100/80">
              Nome da familia
              <input
                type="text"
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
                placeholder="Ex.: Familia Ribeiro"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
              <span className="text-[11px] text-indigo-100/60">
                Usaremos esse nome se precisarmos criar uma nova familia para o vinculo.
              </span>
            </label>
          )}
          {familyInfo.existingFamilyId && familyInfo.existingFamilyName && (
            <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">
              Familia detectada: <strong>{familyInfo.existingFamilyName}</strong>. O novo voluntario e os selecionados
              farao parte dela automaticamente.
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-indigo-100/80 md:col-span-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
            Ministerios em que o voluntario serve
          </legend>
          {optionsLoading ? (
            <span className="text-xs text-indigo-100/60">Carregando ministerios...</span>
          ) : ministries.length === 0 ? (
            <span className="text-xs text-indigo-100/60">{optionsError ?? "Nenhum ministerio cadastrado ainda."}</span>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {ministries.map((ministry) => {
                const checked = selectedMinistryIds.includes(ministry.id);
                return (
                  <label
                    key={ministry.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      checked ? "border-indigo-300/60 bg-indigo-500/20 text-white" : "border-white/10 bg-slate-900/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMinistrySelection(ministry.id)}
                      className="mt-1 h-4 w-4 rounded border border-white/30 bg-transparent text-indigo-400 focus:ring-indigo-400"
                    />
                    <span className="text-sm font-semibold">
                      {ministry.name}
                      {ministry.description && (
                        <span className="block text-xs font-normal text-indigo-100/70">{ministry.description}</span>
                      )}
                      {!ministry.active && <span className="block text-xs font-normal text-rose-200/80">Inativo</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
          >
            {loading ? "Criando..." : "Criar usuario"}
          </button>
          <span className="text-xs text-indigo-100/60">
            A senha padrao e definida pela administracao. Compartilhe com o voluntario e solicite a troca imediata.
          </span>
        </div>
      </form>
    </section>
  );
}
