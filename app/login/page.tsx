"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@lib/supabaseClient";

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trimmedIdentifier = identifier.trim();
      if (!trimmedIdentifier) {
        throw new Error(t("errors.identifierRequired"));
      }
      const normalizedIdentifier = trimmedIdentifier.toLowerCase();
      const isEmail = normalizedIdentifier.includes("@");
      if (!isEmail && !USERNAME_REGEX.test(normalizedIdentifier)) {
        throw new Error(t("errors.invalidUsername"));
      }

      const response = await fetch("/api/auth/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier })
      });
      const json = await response.json();
      if (!response.ok || !json.email) {
        throw new Error(json.error || t("errors.notFound"));
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: json.email,
        password
      });
      if (signInError) {
        throw new Error(signInError.message);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setLoading(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-16 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <section className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4em] text-indigo-200/80">{t("hero.badge")}</p>
            <h1 className="text-4xl font-black md:text-5xl">{t("hero.title")}</h1>
            <p className="max-w-xl text-base text-indigo-100/80">
              Igreja da Cidade Tremembé - Marcos 10:45
              <span className="mt-2 block text-indigo-100/90 italic">
                "Pois nem mesmo o Filho do Homem veio para ser servido, mas para servir e dar a sua vida em resgate por
                muitos."
              </span>
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-indigo-100/80">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {t("hero.pillSupport")}
              </span>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-900/30 backdrop-blur">
            <div className="absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
            <form onSubmit={handleSubmit} className="relative space-y-6 text-left">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">{t("form.title")}</h2>
                <p className="text-sm text-indigo-100/70">{t("form.subtitle")}</p>
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100"
                >
                  {error}
                </p>
              )}
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                {t("form.identifierLabel")}
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
                {t("form.passwordLabel")}
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
                {loading ? t("form.loading") : t("form.submit")}
              </button>
              <p className="text-xs text-indigo-100/60">{t("form.helper")}</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
