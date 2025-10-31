"use client";

import { useEffect, useMemo, useState } from "react";

type MemberEntry = {
  userId: string;
  name: string | null;
  username: string | null;
  role: string | null;
  isLeader: boolean;
};

type MinistrySummary = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  membersCount: number;
};

type CelebrationMinistryBlock = {
  ministryId: string;
  ministryName: string;
  confirmed: MemberEntry[];
  declined: MemberEntry[];
  pending: MemberEntry[];
  totals: {
    totalMembers: number;
    confirmed: number;
    declined: number;
    pending: number;
  };
};

type CelebrationSummary = {
  id: string;
  starts_at: string;
  location: string;
  notes: string | null;
  ministries: CelebrationMinistryBlock[];
};

type ApiResponse = {
  ministries: MinistrySummary[];
  celebrations: CelebrationSummary[];
  generatedAt: string;
  error?: string;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit"
};

export default function AdminAvailabilitiesOverviewCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedMinistryId !== "all") {
          params.set("ministryId", selectedMinistryId);
        }
        const response = await fetch(
          `/api/availabilities/admin${params.toString() ? `?${params.toString()}` : ""}`
        );
        const json: ApiResponse = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Nao foi possivel carregar as disponibilidades.");
        }
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado ao carregar dados.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedMinistryId]);

  const filteredCelebrations = useMemo(() => {
    if (!data) return [];
    if (selectedMinistryId === "all") {
      return data.celebrations;
    }
    return data.celebrations
      .map((celebration) => ({
        ...celebration,
        ministries: celebration.ministries.filter(
          (block) => block.ministryId === selectedMinistryId
        )
      }))
      .filter((celebration) => celebration.ministries.length > 0);
  }, [data, selectedMinistryId]);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Confirmacoes de disponibilidade</h2>
        <p className="text-sm text-indigo-100/80">
          Acompanhe quem ja confirmou, quem recusou e quem ainda esta pendente em cada celebracao.
          Filtre por ministerio para validar antes de gerar a escala.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:flex-row md:items-center">
          <span className="md:w-40">Filtrar por ministerio</span>
          <select
            value={selectedMinistryId}
            onChange={(event) => setSelectedMinistryId(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          >
            <option value="all">Todos os ministerios</option>
            {data?.ministries.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>
                {ministry.name} {ministry.active ? "" : "(inativo)"}
              </option>
            ))}
          </select>
        </label>
        {data?.generatedAt && (
          <span className="text-xs text-indigo-100/60">
            Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      {loading && (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/70">
          Carregando dados de disponibilidade...
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      )}

      {!loading && !error && (!data || filteredCelebrations.length === 0) && (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/70">
          Nenhuma confirmacao registrada para os filtros selecionados.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {filteredCelebrations.map((celebration) => {
          const formattedDate = new Date(celebration.starts_at).toLocaleString(
            "pt-BR",
            DATE_FORMAT
          );
          return (
            <article
              key={celebration.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40"
            >
              <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{formattedDate}</h3>
                  <p className="text-sm text-indigo-100/70">{celebration.location}</p>
                  {celebration.notes && (
                    <p className="text-xs text-indigo-100/60">{celebration.notes}</p>
                  )}
                </div>
                <div className="flex gap-3 text-xs uppercase tracking-widest text-indigo-100/70">
                  {celebration.ministries.map((block) => (
                    <span
                      key={block.ministryId}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-indigo-100/80"
                    >
                      {block.ministryName}: {block.totals.confirmed}/{block.totals.totalMembers} confirmados
                    </span>
                  ))}
                </div>
              </header>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {celebration.ministries.map((block) => (
                  <div
                    key={block.ministryId}
                    className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
                  >
                    <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-200/70">
                      {block.ministryName}
                    </h4>

                    <div className="mt-3 space-y-3 text-sm text-indigo-100/80">
                      <div>
                        <span className="font-semibold text-emerald-300/90">
                          Confirmados ({block.confirmed.length})
                        </span>
                        <ul className="mt-1 space-y-1 text-xs">
                          {block.confirmed.length === 0 ? (
                            <li className="text-indigo-100/60">Nenhum membro confirmou.</li>
                          ) : (
                            block.confirmed.map((member) => (
                              <li key={member.userId} className="flex items-center gap-2">
                                <span>{member.name ?? "Sem nome"}</span>
                                {member.isLeader && (
                                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-100">
                                    Lider
                                  </span>
                                )}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>

                      <div>
                        <span className="font-semibold text-rose-300/90">
                          Recusaram ({block.declined.length})
                        </span>
                        <ul className="mt-1 space-y-1 text-xs">
                          {block.declined.length === 0 ? (
                            <li className="text-indigo-100/60">Nenhum membro recusou.</li>
                          ) : (
                            block.declined.map((member) => (
                              <li key={member.userId}>{member.name ?? "Sem nome"}</li>
                            ))
                          )}
                        </ul>
                      </div>

                      <div>
                        <span className="font-semibold text-amber-300/90">
                          Pendentes ({block.pending.length})
                        </span>
                        <ul className="mt-1 space-y-1 text-xs">
                          {block.pending.length === 0 ? (
                            <li className="text-indigo-100/60">
                              Nenhum membro pendente — escala pronta!
                            </li>
                          ) : (
                            block.pending.map((member) => (
                              <li key={member.userId}>{member.name ?? "Sem nome"}</li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
