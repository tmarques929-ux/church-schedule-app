"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type FamilyRecord = {
  id: string;
  name: string;
  membersCount: number;
};

type UserResult = {
  user_id: string;
  name: string | null;
  username: string | null;
  role: string | null;
  family_id: string | null;
  family_name: string | null;
};

const MIN_SEARCH_LENGTH = 2;

export default function AdminFamilyLinkCard() {
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familiesError, setFamiliesError] = useState<string | null>(null);

  const [newFamilyName, setNewFamilyName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const resolveDisplayName = useCallback((name: string | null, username: string | null) => {
    const normalizedUsername = username?.trim().toLowerCase();
    if (normalizedUsername === "thiagomrib") {
      return "Thiago Marques Ribeiro";
    }
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Sem nome cadastrado";
  }, []);

  const fetchFamilies = useCallback(async () => {
    setFamiliesLoading(true);
    setFamiliesError(null);
    try {
      const response = await fetch("/api/families");
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel carregar as familias.");
      }
      const list: FamilyRecord[] = Array.isArray(json.families) ? json.families : [];
      const sorted = list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setFamilies(sorted);
    } catch (err) {
      setFamiliesError(err instanceof Error ? err.message : "Erro inesperado ao carregar familias.");
    } finally {
      setFamiliesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const selectedFamilyName = useMemo(() => {
    if (!selectedFamilyId) return "Sem familia vinculada";
    const family = families.find((item) => item.id === selectedFamilyId);
    return family?.name ?? "Sem familia vinculada";
  }, [selectedFamilyId, families]);

  async function handleCreateFamily(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    const trimmed = newFamilyName.trim();
    if (!trimmed) {
      setCreateError("Informe um nome para a familia.");
      return;
    }
    setCreateLoading(true);
    try {
      const response = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel criar a familia.");
      }
      setCreateMessage("Familia cadastrada com sucesso.");
      setNewFamilyName("");
      await fetchFamilies();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro inesperado ao salvar familia.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length < MIN_SEARCH_LENGTH) {
      setSearchError(`Digite pelo menos ${MIN_SEARCH_LENGTH} caracteres para buscar.`);
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setLinkError(null);
    setLinkMessage(null);
    try {
      const params = new URLSearchParams({ term, limit: "12" });
      const response = await fetch(`/api/users/search?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel realizar a busca.");
      }
      const results: UserResult[] = Array.isArray(json.results) ? json.results : [];
      setSearchResults(results);
      if (results.length === 0) {
        setSelectedUser(null);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erro inesperado ao buscar usuarios.");
      setSearchResults([]);
      setSelectedUser(null);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSelectUser(user: UserResult) {
    setSelectedUser(user);
    setSelectedFamilyId(user.family_id ?? "");
    setLinkError(null);
    setLinkMessage(null);
  }

  async function handleLink(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;
    setLinkLoading(true);
    setLinkError(null);
    setLinkMessage(null);
    try {
      const response = await fetch("/api/profiles/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.user_id,
          familyId: selectedFamilyId || null
        })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel atualizar o vinculo.");
      }
      const updatedFamilyId = json.profile?.family_id ?? null;
      const updatedFamilyName = json.profile?.family_name ?? null;
      setSelectedUser((current) =>
        current
          ? {
              ...current,
              family_id: updatedFamilyId,
              family_name: updatedFamilyName
            }
          : current
      );
      setSelectedFamilyId(updatedFamilyId ?? "");
      setLinkMessage("Vinculo atualizado com sucesso.");
      setSearchResults((current) =>
        current.map((entry) =>
          entry.user_id === selectedUser.user_id
            ? { ...entry, family_id: updatedFamilyId, family_name: updatedFamilyName }
            : entry
        )
      );
      await fetchFamilies();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Erro inesperado ao salvar vinculo.");
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Vinculo familiar</h2>
        <p className="text-sm text-indigo-100/80">
          Relacione membros da mesma familia para que sirvam no mesmo dia ao gerar a escala. O vinculo e opcional e pode
          ser removido a qualquer momento.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <form onSubmit={handleCreateFamily} className="space-y-3 text-sm text-indigo-100/80">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-indigo-200/70">Nova familia</label>
              <input
                type="text"
                value={newFamilyName}
                onChange={(event) => setNewFamilyName(event.target.value)}
                placeholder="Ex.: Familia Ribeiro"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <button
              type="submit"
              disabled={createLoading}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
            >
              {createLoading ? "Salvando..." : "Cadastrar familia"}
            </button>
            {createError && (
              <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-xs text-rose-100">
                {createError}
              </p>
            )}
            {createMessage && (
              <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-100">
                {createMessage}
              </p>
            )}
          </form>

          <div className="space-y-3 text-sm text-indigo-100/80">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">Familias cadastradas</h3>
            {familiesLoading ? (
              <p className="text-xs text-indigo-100/60">Carregando familias...</p>
            ) : familiesError ? (
              <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-xs text-rose-100">
                {familiesError}
              </p>
            ) : families.length === 0 ? (
              <p className="text-xs text-indigo-100/60">Nenhuma familia registrada ate o momento.</p>
            ) : (
              <ul className="space-y-2">
                {families.map((family) => (
                  <li
                    key={family.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-indigo-100/80"
                  >
                    <span>{family.name}</span>
                    <span className="text-indigo-200/80">
                      {family.membersCount} membro{family.membersCount === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 text-sm text-indigo-100/80">
            <label className="text-xs uppercase tracking-widest text-indigo-200/70">Buscar membro</label>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nome ou username"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
              >
                {searchLoading ? "Buscando..." : "Pesquisar"}
              </button>
            </div>
            {searchError && (
              <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-xs text-rose-100">
                {searchError}
              </p>
            )}
          </form>

          <div className="space-y-3 text-sm text-indigo-100/80">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">Resultados</h3>
            {searchResults.length === 0 ? (
              <p className="text-xs text-indigo-100/60">Nenhum voluntario listado. Utilize o campo de busca.</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => {
                  const isSelected = selectedUser?.user_id === user.user_id;
                  return (
                    <button
                      key={user.user_id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-indigo-300/60 bg-indigo-500/20 text-white"
                          : "border-white/10 bg-slate-900/60 hover:border-indigo-300/40 hover:bg-indigo-500/10"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {resolveDisplayName(user.name, user.username)}
                      </span>
                      <span className="block text-xs text-indigo-100/70">
                        @{user.username ?? "sem-username"} - {user.role ?? "MEMBER"}
                      </span>
                      <span className="block text-xs text-indigo-100/60">
                        Familia atual: {user.family_name ?? "Sem familia vinculada"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleLink} className="space-y-3 text-sm text-indigo-100/80">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
              Vincular familia
            </h3>
            {!selectedUser ? (
              <p className="text-xs text-indigo-100/60">Selecione um voluntario para ajustar o vinculo.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-indigo-100/70">
                    Ajustando vínculo de {resolveDisplayName(selectedUser.name, selectedUser.username)}
                  </span>
                  <select
                    value={selectedFamilyId}
                    onChange={(event) => setSelectedFamilyId(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  >
                    <option value="">Sem familia vinculada</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-indigo-100/60">Familia selecionada: {selectedFamilyName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={linkLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
                  >
                    {linkLoading ? "Salvando..." : "Atualizar vinculo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFamilyId("");
                      setLinkError(null);
                      setLinkMessage(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20"
                  >
                    Remover vinculo
                  </button>
                </div>
                {linkError && (
                  <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-xs text-rose-100">
                    {linkError}
                  </p>
                )}
                {linkMessage && (
                  <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-100">
                    {linkMessage}
                  </p>
                )}
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
