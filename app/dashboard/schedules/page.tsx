"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@lib/supabaseClient';

interface ScheduleRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'published' | string;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-200 border-yellow-300/40',
  published: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40'
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRun[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingRegenerate, setLoadingRegenerate] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedule_runs')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    setSchedules((data as ScheduleRun[]) ?? []);
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const selectedPeriod = useMemo(() => {
    if (!month) return null;
    const [yearStr, monthStr] = month.split('-');
    const parsedYear = Number(yearStr);
    const parsedMonth = Number(monthStr);
    if (Number.isNaN(parsedYear) || Number.isNaN(parsedMonth)) {
      return null;
    }
    return { year: parsedYear, month: parsedMonth };
  }, [month]);

  const existingScheduleForSelection = useMemo(() => {
    if (!selectedPeriod) return null;
    return (
      schedules.find(
        (schedule) =>
          schedule.year === selectedPeriod.year && schedule.month === selectedPeriod.month
      ) ?? null
    );
  }, [schedules, selectedPeriod]);

  const groupedByYear = useMemo(() => {
    return schedules.reduce<Record<number, ScheduleRun[]>>((accumulator, schedule) => {
      if (!accumulator[schedule.year]) {
        accumulator[schedule.year] = [];
      }
      accumulator[schedule.year].push(schedule);
      return accumulator;
    }, {});
  }, [schedules]);

  async function handleGenerate() {
    if (!month) return;
    if (existingScheduleForSelection) {
      setError('Ja existe uma escala para este periodo. Apague-a antes de gerar novamente.');
      setSuccess(null);
      return;
    }
    setLoadingGenerate(true);
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/schedules/generate?month=${month}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Erro ao gerar nova escala. Revise suas permissoes ou tente novamente.");
    } else {
      setSuccess("Escala gerada com sucesso! Reveja os detalhes antes de publicar.");
      await loadSchedules();
    }
    setLoadingGenerate(false);
  }

  async function handleRegenerate() {
    if (!month) return;
    if (!existingScheduleForSelection) {
      setError('Nao ha escala cadastrada para apagar neste periodo.');
      setSuccess(null);
      return;
    }
    setLoadingRegenerate(true);
    setError(null);
    setSuccess(null);
    const deleteResponse = await fetch(`/api/schedules/by-period?month=${month}`, {
      method: "DELETE"
    });
    const deleteJson = await deleteResponse.json().catch(() => ({}));
    if (!deleteResponse.ok) {
      setError(deleteJson.error || "Nao foi possivel remover a escala atual.");
      setLoadingRegenerate(false);
      return;
    }
    const response = await fetch(`/api/schedules/generate?month=${month}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Nao foi possivel gerar a nova escala.");
    } else {
      setSuccess("Escala anterior removida e nova escala criada com sucesso!");
      await loadSchedules();
    }
    setLoadingRegenerate(false);
  }

  async function publish(id: string) {
    setLoadingPublish(id);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/schedules/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Nao foi possivel publicar a escala.");
    } else {
      setSuccess("Escala publicada! As equipes ja podem consultar no painel.");
      await loadSchedules();
    }
    setLoadingPublish(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/80">Governanca ministerial</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">Escalas & equipes</h1>
              <p className="mt-4 max-w-2xl text-sm text-sky-100/80">
                Controle completo de escalas mensais: gere novas versoes, publique para a igreja e exporte
                materiais personalizados para cada equipe.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-sky-100/80">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
              >
                Voltar ao painel
              </Link>
              <span className="rounded-full border border-sky-200/30 bg-sky-500/20 px-4 py-2 font-semibold text-sky-100">
                Organizacao que inspira confianca
              </span>
            </div>
          </div>
        </header>

        {(error || success) && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
            {error && <p className="text-rose-200">Aviso: {error}</p>}
            {success && <p className="text-emerald-200">Sucesso: {success}</p>}
          </div>
        )}


        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Gerar nova escala</h2>
              <p className="mt-2 text-sm text-sky-100/80">
                Escolha o mes desejado no formato ano-mes e gere uma nova escala baseada nas
                disponibilidades atuais.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center">
              <label className="flex flex-col gap-2 text-sky-100/80">
                Mes (YYYY-MM)
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
              <button
                type="button"
                disabled={
                  loadingGenerate || loadingRegenerate || !month || Boolean(existingScheduleForSelection)
                }
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
              >
                {loadingGenerate ? 'Processando...' : 'Gerar escala'}
              </button>
              <button
                type="button"
                disabled={
                  loadingGenerate || loadingRegenerate || !month || !existingScheduleForSelection
                }
                onClick={handleRegenerate}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-rose-100/60"
              >
                {loadingRegenerate ? 'Processando...' : 'Apagar e gerar nova'}
              </button>
            </div>
            {existingScheduleForSelection && (
              <p className="rounded-2xl border border-indigo-300/20 bg-indigo-500/10 p-3 text-xs text-sky-100/80">
                Ja existe uma escala {existingScheduleForSelection.status === 'published' ? 'publicada' : 'em rascunho'} para este periodo.
                Use o botao de apagar para gerar uma nova versao.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-white">Escalas cadastradas</h2>
            <p className="text-sm text-sky-100/80">
              Organizadas por ano. Publique quando estiver tudo validado com as liderancas.
            </p>
          </div>

          <div className="mt-6 space-y-8">
            {Object.keys(groupedByYear).length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-sm text-sky-100/70">
                Ainda nao existe nenhuma escala. Gere a primeira usando o formulario acima.
              </div>
            )}

            {Object.entries(groupedByYear)
              .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
              .map(([year, items]) => (
                <div key={year} className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Ano {year}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {items
                      .slice()
                      .sort((a, b) => b.month - a.month)
                      .map((schedule) => {
                        const label = `${String(schedule.month).padStart(2, '0')}/${schedule.year}`;
                        const statusStyle =
                          statusStyles[schedule.status] ??
                          'bg-white/10 text-slate-100 border-white/20';
                        return (
                          <article
                            key={schedule.id}
                            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40 transition hover:border-indigo-200/40"
                          >
                            <header className="flex flex-col gap-2">
                              <p className="text-xs uppercase tracking-widest text-sky-200/70">
                                Escala mensal
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <h4 className="text-xl font-semibold text-white">{label}</h4>
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyle}`}
                                >
                                  {schedule.status === 'published' ? 'Publicada' : 'Rascunho'}
                                </span>
                              </div>
                            </header>

                            <div className="flex flex-wrap gap-3 text-xs text-sky-100/70">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                ID - {schedule.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Referencia: {label}
                              </span>
                            </div>

                            <footer className="mt-2 flex flex-wrap items-center gap-3">
                              {schedule.status === 'draft' && (
                                <button
                                  type="button"
                                  onClick={() => publish(schedule.id)}
                                  disabled={loadingPublish === schedule.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
                                >
                                  {loadingPublish === schedule.id ? 'Publicando...' : 'Publicar escala'}
                                </button>
                              )}
                              <a
                                href={`/api/schedules/${schedule.id}?format=csv`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/20"
                              >
                                Exportar CSV
                              </a>
                              <a
                                href={`/api/schedules/${schedule.id}?format=pdf`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/20"
                              >
                                Exportar PDF
                              </a>
                            </footer>
                          </article>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
