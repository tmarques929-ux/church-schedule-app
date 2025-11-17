"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MemberRecord = {
  id: string;
  name: string;
  username: string | null;
  role: "ADMIN" | "LEADER" | "MEMBER";
  birthDate: string | null;
  family: { id: string; name: string } | null;
  ministries: string[];
};

type FamilyRecord = {
  id: string;
  name: string;
  membersCount?: number;
};

type MembersResponse = {
  members: MemberRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  features?: {
    birthDate?: boolean;
  };
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ROLES: Array<{ label: string; value: "" | "ADMIN" | "LEADER" | "MEMBER" }> = [
  { label: "Todos os papeis", value: "" },
  { label: "Apenas administradores", value: "ADMIN" },
  { label: "Apenas líderes de ministério", value: "LEADER" },
  { label: "Apenas membros", value: "MEMBER" }
];

interface AdminMembersClientProps {
  adminName: string;
}

export default function AdminMembersClient({ adminName }: AdminMembersClientProps) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "ADMIN" | "LEADER" | "MEMBER">("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [birthDateDrafts, setBirthDateDrafts] = useState<Record<string, string>>({});
  const [birthDateSavingId, setBirthDateSavingId] = useState<string | null>(null);
  const [birthDateEnabled, setBirthDateEnabled] = useState(true);

  const fetchController = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/families");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Nao foi possivel carregar as familias.");
        if (!active) return;
        const list: FamilyRecord[] = Array.isArray(json.families) ? json.families : [];
        setFamilies(list);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadMembers = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize)
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (roleFilter) params.set("role", roleFilter);
        if (familyFilter) params.set("familyId", familyFilter);

        const response = await fetch(`/api/admin/members?${params.toString()}`, { signal });
        const text = await response.text();

        if (!text) {
          if (!response.ok) throw new Error("Nao foi possivel carregar os membros.");
          setMembers([]);
          setTotal(0);
          return;
        }

        const json = JSON.parse(text) as MembersResponse & { error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar os membros.");
        }

        const list: MemberRecord[] = Array.isArray(json.members) ? json.members : [];
        setMembers(list);
        setTotal(json.pagination?.total ?? 0);
        setBirthDateEnabled(json.features?.birthDate !== false);
        setBirthDateDrafts((currentDrafts) => {
          const nextDrafts: Record<string, string> = {};
          list.forEach((member) => {
            if (currentDrafts[member.id] !== undefined) {
              nextDrafts[member.id] = currentDrafts[member.id];
            }
          });
          return nextDrafts;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Erro inesperado ao listar membros.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [debouncedSearch, roleFilter, familyFilter, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;
    loadMembers(controller.signal);
    return () => controller.abort();
  }, [loadMembers]);

  const maxBirthDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const totalPages = useMemo(() => Math.max(Math.ceil(total / pageSize), 1), [pageSize, total]);

  const handleRoleChange = useCallback(
    async (memberId: string, nextRole: "ADMIN" | "LEADER" | "MEMBER") => {
      setUpdatingRoleId(memberId);
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateRole",
            userId: memberId,
            role: nextRole
          })
        });
        const text = await response.text();
        const json = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel atualizar o papel.");
        }
        setMembers((current) =>
          current.map((member) =>
            member.id === memberId ? { ...member, role: nextRole } : member
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar papel do membro.");
      } finally {
        setUpdatingRoleId(null);
      }
    },
    []
  );

  const handleNavigateToMember = useCallback(
    (memberId: string) => {
      router.push(`/dashboard/admin?focus=ministries&user=${memberId}`);
    },
    [router]
  );

  const handleBirthDateInput = useCallback((memberId: string, value: string) => {
    setBirthDateDrafts((current) => ({ ...current, [memberId]: value }));
  }, []);

  const handleBirthDateReset = useCallback((memberId: string) => {
    setBirthDateDrafts((current) => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });
  }, []);

  const handleBirthDateSave = useCallback(
    async (memberId: string) => {
      if (!birthDateEnabled) return;
      const member = members.find((item) => item.id === memberId);
      if (!member) return;
      const draft = birthDateDrafts[memberId];
      const original = member.birthDate ?? "";
      const nextValue = draft !== undefined ? draft : original;
      if (nextValue === original) return;

      setBirthDateSavingId(memberId);
      setError(null);
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateBirthDate",
            userId: memberId,
            birthDate: nextValue || null
          })
        });
        const text = await response.text();
        const json = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel atualizar a data de nascimento.");
        }

        const confirmedBirthDate: string | null =
          typeof json.birthDate === "string" ? json.birthDate : nextValue || null;

        setMembers((current) =>
          current.map((item) =>
            item.id === memberId ? { ...item, birthDate: confirmedBirthDate } : item
          )
        );
        setBirthDateDrafts((current) => {
          const next = { ...current };
          delete next[memberId];
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar data de nascimento.");
      } finally {
        setBirthDateSavingId(null);
      }
    },
    [birthDateDrafts, birthDateEnabled, members]
  );

  const summary = useMemo(() => {
    const admins = members.filter((member) => member.role === "ADMIN").length;
    const familiesSet = new Set(
      members
        .map((member) => member.family?.id)
        .filter((id): id is string => Boolean(id))
    );
    return {
      admins,
      families: familiesSet.size
    };
  }, [members]);

  const birthDateHeaderLabel = birthDateEnabled ? "Nascimento" : "Nascimento (indisponivel)";

  return (
    <section className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-indigo-200/80">Painel administrativo</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">Voluntários cadastrados</h1>
              <p className="mt-3 max-w-2xl text-sm text-indigo-100/80">
                Consulte todos os perfis registrados, ajuste acessos e acesse rapidamente ações administrativas.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-indigo-100/80">
              <span className="text-xs uppercase tracking-widest text-indigo-200/80">
                Acesso de {adminName}
              </span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
                >
                  Voltar ao painel
                </Link>
                <Link
                  href="/dashboard/admin?focus=family"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
                >
                  Vincular famílias
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
              Buscar voluntário
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome ou username"
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
              Papel
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as "" | "ADMIN" | "MEMBER");
                  setPage(1);
                }}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              >
                {ROLES.map((item) => (
                  <option key={item.label} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
              Família
              <select
                value={familyFilter}
                onChange={(event) => {
                  setFamilyFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              >
                <option value="">Todas as famílias</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
              Itens por página
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs uppercase tracking-widest text-indigo-200/70">
            <span>Total listado: {total}</span>
            <span>Admins: {summary.admins}</span>
            <span>Famílias representadas: {summary.families}</span>
          </div>
        </div>

        {!birthDateEnabled && (
          <div className="rounded-3xl border border-amber-300/30 bg-amber-500/10 px-6 py-4 text-sm text-amber-100 shadow-inner shadow-amber-900/30">
            Campo de aniversários indisponível neste ambiente. Execute a migration que adiciona
            <code className="mx-1 rounded bg-amber-300/20 px-1 py-0.5 text-xs font-mono text-amber-50">birth_date</code>
            à tabela<code className="mx-1 rounded bg-amber-300/20 px-1 py-0.5 text-xs font-mono text-amber-50">profiles</code>
            para habilitar o cadastro e a edição de aniversários.
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-lg shadow-indigo-900/30">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-indigo-100/90">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-indigo-100/60">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">{birthDateHeaderLabel}</th>
                  <th className="px-4 py-3 text-left">Família</th>
                  <th className="px-4 py-3 text-left">Ministérios</th>
                  <th className="px-4 py-3 text-left">Papel</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => {
                  const draftBirthDate = birthDateDrafts[member.id];
                  const originalBirthDate = member.birthDate ?? "";
                  const effectiveBirthDate = draftBirthDate ?? originalBirthDate;
                  const hasBirthDateDraft = draftBirthDate !== undefined;
                  const birthDateChanged =
                    hasBirthDateDraft && draftBirthDate !== originalBirthDate;
                  const showMissingBirthDateHint = !member.birthDate && !hasBirthDateDraft;

                  return (
                    <tr key={member.id} className="hover:bg-white/5">
                      <td className="px-4 py-4 text-white">
                        <button
                          type="button"
                          onClick={() => handleNavigateToMember(member.id)}
                          className="flex w-full flex-col rounded-2xl border border-transparent px-3 py-2 text-left transition hover:border-indigo-400/40 hover:bg-white/5 focus:outline-none focus-visible:border-indigo-400/70 focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                          title="Abrir perfil completo no painel administrativo"
                        >
                          <span className="font-semibold">{member.name || "Sem nome cadastrado"}</span>
                          <span className="text-xs text-indigo-100/60">{member.id}</span>
                          <span className="text-[11px] text-indigo-200/70">Clique para editar rapidamente</span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span>{member.username ?? "Sem username"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {birthDateEnabled ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="date"
                              value={effectiveBirthDate}
                              max={maxBirthDate}
                              disabled={birthDateSavingId === member.id}
                              onChange={(event) => handleBirthDateInput(member.id, event.target.value)}
                              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleBirthDateSave(member.id)}
                                disabled={!birthDateChanged || birthDateSavingId === member.id}
                                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/70 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500/80 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {birthDateSavingId === member.id ? "Salvando..." : "Salvar"}
                              </button>
                              {hasBirthDateDraft && (
                                <button
                                  type="button"
                                  onClick={() => handleBirthDateReset(member.id)}
                                  disabled={birthDateSavingId === member.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-indigo-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                            {showMissingBirthDateHint && (
                              <p className="text-[11px] text-indigo-100/60">Sem data cadastrada</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-indigo-100/50">
                            Execute a migration para habilitar o campo de aniversários.
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {member.family ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100/80">
                            {member.family.name}
                          </span>
                        ) : (
                          <span className="text-xs text-indigo-100/50">Sem familia</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-indigo-100/75">
                        {member.ministries.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {member.ministries.map((label) => (
                              <span
                                key={`${member.id}-${label}`}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-indigo-100/80"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-indigo-100/45">Nenhum ministerio vinculado</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={member.role}
                          disabled={updatingRoleId === member.id}
                          onChange={(event) =>
                            handleRoleChange(member.id, event.target.value as "ADMIN" | "LEADER" | "MEMBER")
                          }
                          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="LEADER">LEADER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Link
                            href={`/dashboard/admin?focus=ministries&user=${member.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-indigo-100 transition hover:bg-white/20"
                          >
                            Ministerios
                          </Link>
                          <Link
                            href={`/dashboard/admin?focus=family&user=${member.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-3 py-1 font-semibold text-white transition hover:bg-indigo-500/30"
                          >
                            Familia
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-indigo-100/60">
                      Nenhum voluntario encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="border-t border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-indigo-100/70">
              Carregando voluntários...
            </div>
          )}

          {error && (
            <div className="border-t border-rose-300/30 bg-rose-500/10 px-4 py-3 text-center text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-indigo-100/60">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page === 1 || loading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}



