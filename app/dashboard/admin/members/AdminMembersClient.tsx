"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type MemberRecord = {
  id: string;
  name: string;
  username: string | null;
  role: "ADMIN" | "LEADER" | "MEMBER";
  family: { id: string; name: string } | null;
  ministries: Array<{
    id: string;
    name: string;
    isLeader: boolean;
  }>;
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

  const fetchController = useRef<AbortController | null>(null);

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

        setMembers(Array.isArray(json.members) ? json.members : []);
        setTotal(json.pagination?.total ?? 0);
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

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-lg shadow-indigo-900/30">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-indigo-100/90">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-indigo-100/60">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Família</th>
                  <th className="px-4 py-3 text-left">Ministérios</th>
                  <th className="px-4 py-3 text-left">Papel</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5">
                    <td className="px-4 py-4 font-semibold text-white">
                      <div className="flex flex-col">
                        <span>{member.name || "Sem nome cadastrado"}</span>
                        <span className="text-xs text-indigo-100/60">{member.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span>{member.username ?? "Sem username"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {member.family ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100/80">
                          {member.family.name}
                        </span>
                      ) : (
                        <span className="text-xs text-indigo-100/50">Sem família</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-indigo-100/75">
                      {member.ministries.length > 0 ? (
                        <span>{member.ministries.join(", ")}</span>
                      ) : (
                        <span className="text-indigo-100/45">Nenhum ministério vinculado</span>
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
                          Ministérios
                        </Link>
                        <Link
                          href={`/dashboard/admin?focus=family&user=${member.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-3 py-1 font-semibold text-white transition hover:bg-indigo-500/30"
                        >
                          Família
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-indigo-100/60">
                      Nenhum voluntário encontrado para os filtros selecionados.
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


