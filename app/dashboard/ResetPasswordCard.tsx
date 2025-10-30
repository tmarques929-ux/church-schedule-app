"use client";

import { useState } from "react";

export default function ResetPasswordCard() {
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("MudarSenha123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.trim().length < 8) {
      setError("Use pelo menos 8 caracteres na nova senha.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", identifier: identifier.trim(), newPassword })
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Nao foi possivel redefinir a senha.");
      } else {
        setMessage("Senha redefinida com sucesso! Compartilhe a nova senha com o voluntario.");
        setIdentifier("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Redefinir senha de voluntario</h2>
        <p className="text-sm text-indigo-100/80">Informe o usuario (ou email) do voluntario para atribuir uma nova senha temporaria.</p>
      </div>
      {(error || message) && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
          {error && <p className="text-rose-200">{error}</p>}
          {message && <p className="text-emerald-200">{message}</p>}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Usuario (ou email)
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Nova senha temporaria
          <input
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
          <span className="text-xs text-indigo-100/60">
            A senha pode ser alterada pelo voluntario depois do primeiro login.
          </span>
        </div>
      </form>
    </section>
  );
}
