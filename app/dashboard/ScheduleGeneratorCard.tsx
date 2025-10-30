"use client";

import { useState } from "react";

export default function ScheduleGeneratorCard() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleGenerate() {
    if (!month) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/schedules/generate?month=${month}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Nao foi possivel gerar a escala.");
      } else {
        setSuccess("Escala gerada com sucesso! Revise em Escalas & equipes antes de publicar.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Gerar escala mensal</h2>
          <p className="text-sm text-indigo-100/80">
            Escolha o mes desejado (formato AAAA-MM). A escala e criada como rascunho para revisao.
          </p>
        </div>
      </div>
      {(error || success) && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
          {error && <p className="text-rose-200">{error}</p>}
          {success && <p className="text-emerald-200">{success}</p>}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
          Mes (AAAA-MM)
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !month}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
        >
          {loading ? "Gerando..." : "Gerar escala"}
        </button>
      </div>
    </section>
  );
}
