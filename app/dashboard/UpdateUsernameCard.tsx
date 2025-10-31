"use client";

import { useState } from "react";

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

export default function UpdateUsernameCard() {
  const [identifier, setIdentifier] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();
    const normalizedNewUsername = newUsername.trim().toLowerCase();

    if (!trimmedIdentifier) {
      setError("Informe o usuario atual ou email cadastrado.");
      return;
    }
    if (!normalizedNewUsername) {
      setError("Informe o novo username.");
      return;
    }
    if (!USERNAME_REGEX.test(normalizedNewUsername)) {
      setError("Username deve conter apenas letras, numeros e os caracteres ._-");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, string> = {
        action: "updateUsername",
        newUsername: normalizedNewUsername
      };

      if (trimmedIdentifier.includes("@")) {
        payload.email = trimmedIdentifier.toLowerCase();
      } else {
        payload.currentUsername = trimmedIdentifier.toLowerCase();
      }

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Nao foi possivel atualizar o username.");
      } else {
        setMessage("Username atualizado com sucesso.");
        setIdentifier("");
        setNewUsername("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao atualizar username.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Atualizar username de voluntario</h2>
        <p className="text-sm text-indigo-100/80">
          Use para alterar o identificador de acesso de um voluntario. Informe o email atual ou o username antigo.
        </p>
      </div>
      {(error || message) && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
          {error && <p className="text-rose-200">{error}</p>}
          {message && <p className="text-emerald-200">{message}</p>}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Email ou username atual
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Novo username
          <input
            type="text"
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
          >
            {loading ? "Atualizando..." : "Atualizar username"}
          </button>
          <span className="text-xs text-indigo-100/60">
            O novo username sera usado no login imediato apos a atualizacao.
          </span>
        </div>
      </form>
    </section>
  );
}
