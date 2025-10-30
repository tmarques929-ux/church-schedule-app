"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    let emailToUse = identifier.trim();
    try {
      if (!emailToUse) {
        throw new Error("Informe o usuario ou email.");
      }
      if (!emailToUse.includes("@")) {
        const response = await fetch("/api/auth/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: emailToUse })
        });
        const json = await response.json();
        if (!response.ok || !json.email) {
          throw new Error(json.error || "Usuario nao encontrado.");
        }
        emailToUse = json.email;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });
      if (signInError) {
        throw new Error(signInError.message);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao entrar.");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-16 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <section className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4em] text-indigo-200/80">igreja da cidade tremembe</p>
            <h1 className="text-4xl font-black md:text-5xl">Painel ministerial - uma igreja para pertencer</h1>
            <p className="max-w-xl text-base text-indigo-100/80">
              Acesse com suas credenciais para administrar escalas, disponibilidades e agenda de celebracoes. Novos logins sao provisionados pela lideranca e devem alterar a senha apos o primeiro acesso.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-indigo-100/80">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/30 bg-indigo-500/20 px-4 py-2 font-semibold">
                Servir bem, amar melhor
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Suporte: ministerios@icctremembe.com
              </span>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-900/30 backdrop-blur">
            <div className="absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
            <form onSubmit={handleSubmit} className="relative space-y-6 text-left">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">Bem-vindo de volta</h2>
                <p className="text-sm text-indigo-100/70">Entre com seu usuario ou email cadastrado pela lideranca.</p>
              </div>
              {error && <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">{error}</p>}
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                Usuario ou email
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  required
                  autoComplete="username"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                Senha
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full border border-indigo-300/40 bg-indigo-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
              >
                {loading ? "Entrando..." : "Entrar no painel"}
              </button>
              <p className="text-xs text-indigo-100/60">Esqueceu sua senha? Fale com o administrador para redefinir.</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
