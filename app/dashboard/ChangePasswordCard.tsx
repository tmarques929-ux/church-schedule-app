"use client";

import { useState } from "react";
import { supabase } from "@lib/supabaseClient";

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword.length < 8) {
      setError("Use pelo menos 8 caracteres na nova senha.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmacao nao coincide com a nova senha.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: getUserError
      } = await supabase.auth.getUser();
      if (getUserError || !user?.email) {
        throw new Error(getUserError?.message || "Nao foi possivel obter os dados da conta.");
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (reauthError) {
        throw new Error("Senha atual incorreta.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage("Senha atualizada com sucesso! Use a nova senha no proximo acesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Alterar senha</h2>
        <p className="text-sm text-indigo-100/80">
          Atualize sua senha para manter o acesso seguro. Informe a senha atual e defina uma nova.
        </p>
      </div>
      {error && (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
          Senha atual
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
            autoComplete="current-password"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Nova senha
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Confirmar nova senha
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            required
            autoComplete="new-password"
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
          >
            {loading ? "Atualizando..." : "Atualizar senha"}
          </button>
          <span className="text-xs text-indigo-100/60">
            Sugestao: use letras maiusculas, minusculas e numeros para uma senha mais forte.
          </span>
        </div>
      </form>
    </section>
  );
}
