"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@lib/supabaseClient";

interface Celebration {
  id: string;
  starts_at: string;
  location: string;
  notes: string | null;
}

export default function AvailabilitiesPage() {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadData() {
      setError(null);

      const {
        data: userData,
        error: userError
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        return;
      }

      const currentUserId = userData?.user?.id;
      if (!currentUserId) {
        setError("Nao foi possivel identificar o usuario logado.");
        return;
      }

      const { data: celebrationsData, error: celebrationsError } = await supabase
        .from("celebrations")
        .select("id, starts_at, location, notes")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");

      if (celebrationsError) {
        setError(celebrationsError.message);
        return;
      }
      setCelebrations((celebrationsData as Celebration[]) ?? []);

      const { data: availabilitiesData, error: availabilitiesError } = await supabase
        .from("availabilities")
        .select("celebration_id, available")
        .eq("member_id", currentUserId);

      if (!availabilitiesError && availabilitiesData) {
        const map: Record<string, boolean> = {};
        availabilitiesData.forEach((item: any) => {
          map[item.celebration_id] = item.available;
        });
        setAvailabilities(map);
      } else if (availabilitiesError) {
        setError(availabilitiesError.message);
      }
    }
    loadData();
  }, []);

  const filteredCelebrations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return celebrations.filter((celebration) => {
      const matchesSearch =
        !term ||
        celebration.location.toLowerCase().includes(term) ||
        (celebration.notes ?? "").toLowerCase().includes(term) ||
        new Date(celebration.starts_at).toLocaleDateString("pt-BR").toLowerCase().includes(term);

      const isAvailable = Boolean(availabilities[celebration.id]);
      const matchesAvailability = showOnlyAvailable ? isAvailable : true;
      return matchesSearch && matchesAvailability;
    });
  }, [celebrations, availabilities, showOnlyAvailable, search]);

  async function toggleAvailability(celebrationId: string) {
    const available = !availabilities[celebrationId];
    setPendingId(celebrationId);
    setError(null);
    setAvailabilities((prev) => ({ ...prev, [celebrationId]: available }));

    const response = await fetch("/api/availabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ celebration_id: celebrationId, available })
    });

    if (!response.ok) {
      const json = await response.json();
      setError(json.error || "Nao foi possivel atualizar sua disponibilidade.");
      setAvailabilities((prev) => ({ ...prev, [celebrationId]: !available }));
    }

    setPendingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Servindo com alegria</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">🗓️ Minhas disponibilidades</h1>
              <p className="mt-4 max-w-2xl text-sm text-emerald-100/80">
                Atualize com rapidez os dias em que voce pode servir. Cada confirmacao ajuda a montar escalas
                equilibradas e acolhedoras.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-emerald-100/80">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
              >
                ↩️ Voltar ao painel
              </Link>
              <span className="rounded-full border border-emerald-200/30 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-100">
                🤝 Juntos pela Igreja da Cidade Tremembe
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-rose-200">
            ⚠️ {error}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-emerald-900/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Agenda de cultos</h2>
              <p className="mt-2 text-sm text-emerald-100/80">
                Marque presenca com antecedencia. Voce pode filtrar por local ou data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-sm text-emerald-100/80">
                🔍
                <input
                  type="text"
                  placeholder="Buscar por data ou local"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-emerald-100/40 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowOnlyAvailable((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  showOnlyAvailable
                    ? "border-emerald-200/40 bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/20"
                    : "border-white/10 bg-white/10 text-emerald-100/80 hover:bg-white/20"
                }`}
              >
                {showOnlyAvailable ? "✅ Mostrando apenas confirmados" : "👀 Mostrar apenas confirmados"}
              </button>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {filteredCelebrations.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-sm text-emerald-100/70">
                Nada por aqui no filtro atual. Que tal remover os filtros ou consultar a secretaria? 💌
              </div>
            )}

            {filteredCelebrations.map((celebration) => {
              const startsAtDate = new Date(celebration.starts_at);
              const formattedDate = startsAtDate.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long"
              });
              const formattedTime = startsAtDate.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
              });
              const available = Boolean(availabilities[celebration.id]);

              return (
                <article
                  key={celebration.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40 transition hover:border-emerald-200/40"
                >
                  <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-emerald-200/70">Proximo culto</p>
                      <h3 className="text-xl font-semibold text-white">
                        {formattedDate} · {formattedTime}
                      </h3>
                      <p className="text-sm font-semibold text-emerald-100">
                        {celebration.notes ?? "Celebracao sem nome"}
                      </p>
                      <p className="text-sm text-emerald-100/70">📍 {celebration.location}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAvailability(celebration.id)}
                      disabled={pendingId === celebration.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        available
                          ? "border-emerald-200/40 bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-400"
                          : "border-white/10 bg-white/10 text-emerald-100/80 hover:bg-white/20"
                      } ${pendingId === celebration.id ? "cursor-wait opacity-70" : ""}`}
                    >
                      {pendingId === celebration.id
                        ? "Enviando..."
                        : available
                        ? "✅ Confirmado para servir"
                        : "🤝 Marcar presenca"}
                    </button>
                  </header>
                  <footer className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/70">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      ID · {celebration.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      🕒 {startsAtDate.toLocaleString("pt-BR")}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {available ? "🟢 Voce esta escalado(a)" : "⚪ Aguardando confirmacao"}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
