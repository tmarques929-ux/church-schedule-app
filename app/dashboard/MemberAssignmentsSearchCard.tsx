"use client";

import { useState } from "react";

interface AssignmentItem {
  celebration: { id: string; starts_at: string; location: string; notes: string | null };
  ministry: { name: string } | null;
  role: { name: string } | null;
}

interface ResultItem {
  user_id: string;
  name: string;
  role: string;
  assignments: AssignmentItem[];
}

export default function MemberAssignmentsSearchCard() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/members/search?term=${encodeURIComponent(trimmed)}`);
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Nao foi possivel buscar os membros.");
      } else {
        setResults(json.results ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado na busca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Agenda por voluntario</h2>
        <p className="text-sm text-indigo-100/80">
          Digite o nome do membro para visualizar os proximos compromissos e ministerios em que servira.
        </p>
      </div>
      <form onSubmit={handleSearch} className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por nome"
          className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
        >
          {loading ? "Consultando..." : "Buscar"}
        </button>
      </form>
      {error && <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">{error}</p>}
      <div className="mt-6 space-y-4">
        {results.length === 0 && !loading && !error && (
          <p className="text-sm text-indigo-100/70">Nenhum voluntario encontrado para este termo.</p>
        )}
        {results.map((result) => (
          <article key={result.user_id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40">
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{result.name}</h3>
                <p className="text-xs uppercase tracking-widest text-indigo-200/70">Papel: {result.role}</p>
              </div>
              <span className="text-xs text-indigo-100/60">ID: {result.user_id.slice(0, 8).toUpperCase()}</span>
            </header>
            <div className="mt-4 space-y-3">
              {result.assignments.length === 0 ? (
                <p className="text-sm text-indigo-100/70">Nenhum compromisso futuro encontrado.</p>
              ) : (
                result.assignments.map((assignment) => {
                  const date = assignment.celebration ? new Date(assignment.celebration.starts_at) : null;
                  const dateLabel = date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Data indefinida';
                  const timeLabel = date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={`${assignment.celebration?.id}-${assignment.role?.name ?? ''}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/80">
                      <p className="font-semibold text-white">
                        {assignment.ministry?.name ?? 'Ministerio'} · {assignment.role?.name ?? 'Funcao'}
                      </p>
                      <p>
                        {dateLabel} {timeLabel ? `- ${timeLabel}` : ''}
                      </p>
                      <p>{assignment.celebration?.location}</p>
                      {assignment.celebration?.notes && <p className="text-indigo-100/60">Obs: {assignment.celebration.notes}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
