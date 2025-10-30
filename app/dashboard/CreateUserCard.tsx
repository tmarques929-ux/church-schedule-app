"use client";

import { useEffect, useState } from "react";

type Props = {
  canManageUsers: boolean;
};

type MinistryOption = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

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

  function toggleMinistrySelection(ministryId: string) {
    setSelectedMinistryIds((current) =>
      current.includes(ministryId) ? current.filter((id) => id !== ministryId) : [...current, ministryId]
    );
  }

  if (!canManageUsers) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          username: username.trim().toLowerCase(),
          ministryIds: selectedMinistryIds
        })
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

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
