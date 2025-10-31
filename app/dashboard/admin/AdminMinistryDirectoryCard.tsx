"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MinistryEntry = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  members?: Array<{
    userId: string;
    name: string | null;
    username: string | null;
    role: string | null;
  }>;
  leaders?: Array<{
    userId: string;
    name: string | null;
    username: string | null;
  }>;
};

export default function AdminMinistryDirectoryCard() {
  const [ministries, setMinistries] = useState<MinistryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function fetchMinistries() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ministries?includeMembers=true");
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel carregar os ministerios.");
      }
      setMinistries(Array.isArray(json.ministries) ? json.ministries : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar ministerios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMinistries();
  }, []);

  const totalActive = useMemo(() => ministries.filter((item) => item.active).length, [ministries]);
  const totalInactive = useMemo(() => ministries.filter((item) => !item.active).length, [ministries]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Informe o nome do ministerio.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/ministries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          active
        })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Nao foi possivel criar o ministerio.");
      }

      setFormMessage("Ministerio cadastrado com sucesso.");
      setName("");
      setDescription("");
      setActive(true);

      await fetchMinistries();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro inesperado ao cadastrar ministerio.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Cadastro e panorama de ministerios</h2>
        <p className="text-sm text-indigo-100/80">
          Registre novos ministerios e visualize quem serve em cada equipe. Lideres aparecem automaticamente
          quando possuem papel de administrador.
        </p>
      </div>

      <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
          Nome do ministerio
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            placeholder="Ex.: Bandas"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
          Descricao (opcional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            placeholder="Resumo ou observacoes sobre o ministerio"
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-indigo-100/80">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-transparent text-indigo-400 focus:ring-indigo-400"
          />
          Ministerio ativo
        </label>

        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
        >
          {creating ? "Salvando..." : "Cadastrar ministerio"}
        </button>

        {formError && (
          <p className="md:col-span-2 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
            {formError}
          </p>
        )}
        {formMessage && (
          <p className="md:col-span-2 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">
            {formMessage}
          </p>
        )}
      </form>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-indigo-100/80">
        <div className="flex flex-wrap gap-4 text-xs uppercase tracking-widest text-indigo-200/70">
          <span>Ativos: {totalActive}</span>
          <span>Inativos: {totalInactive}</span>
          <span>Total: {ministries.length}</span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-xs text-indigo-100/60">Carregando ministerios...</p>
        ) : error ? (
          <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">{error}</p>
        ) : ministries.length === 0 ? (
          <p className="text-xs text-indigo-100/60">Nenhum ministerio cadastrado ainda.</p>
        ) : (
          ministries.map((ministry) => (
            <article
              key={ministry.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/30"
            >
              <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{ministry.name}</h3>
                  {ministry.description && (
                    <p className="text-sm text-indigo-100/70">{ministry.description}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    ministry.active
                      ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                      : "border-rose-300/30 bg-rose-500/20 text-rose-100"
                  }`}
                >
                  {ministry.active ? "Ativo" : "Inativo"}
                </span>
              </header>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
                    Lideranca (admins)
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-indigo-100/80">
                    {ministry.leaders && ministry.leaders.length > 0 ? (
                      ministry.leaders.map((leader) => (
                        <li key={leader.userId} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <span className="block font-semibold text-white">
                            {leader.name ?? "Sem nome cadastrado"}
                          </span>
                          <span className="text-xs text-indigo-100/70">@{leader.username ?? "sem-username"}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-indigo-100/60">Nenhum lider identificado.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">
                    Voluntarios vinculados
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-indigo-100/80">
                    {ministry.members && ministry.members.length > 0 ? (
                      ministry.members.map((member) => (
                        <li key={member.userId} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <span className="block font-semibold text-white">
                            {member.name ?? "Sem nome cadastrado"}
                          </span>
                          <span className="text-xs text-indigo-100/70">
                            @{member.username ?? "sem-username"} · {member.role ?? "MEMBER"}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-indigo-100/60">Nenhum voluntario vinculado.</li>
                    )}
                  </ul>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
