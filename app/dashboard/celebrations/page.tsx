"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@lib/supabaseClient";

type Celebration = {
  id: string;
  starts_at: string;
  location: string;
  notes: string | null;
};

type CelebrationInsert = {
  starts_at: string;
  location: string;
  notes: string | null;
};

const QUICK_NAMES = ["Homens de Honra", "Feminina", "Eleve", "Heranca Real"];
const THIRTY_WEEKS = 30;

const toDateInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const toDateTimeInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const parseDate = (value: string) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDateTime = (value: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const withTime = (day: Date, hour: number, minute: number) => {
  const copy = new Date(day);
  copy.setHours(hour, minute, 0, 0);
  return copy;
};

const nextSunday = () => {
  const today = new Date();
  const result = new Date(today);
  const diff = (7 - result.getDay()) % 7;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const nextFriday1930 = () => {
  const today = new Date();
  const result = new Date(today);
  const diff = (5 - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  result.setHours(19, 30, 0, 0);
  return result;
};

export default function CelebrationsPage() {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [rangeStart, setRangeStart] = useState(toDateInput(nextSunday()));
  const [rangeEnd, setRangeEnd] = useState(toDateInput(new Date(nextSunday().getTime() + 56 * 86400000)));
  const [sundayMorningName, setSundayMorningName] = useState("Culto Domingo 10h");
  const [sundayEveningName, setSundayEveningName] = useState("Culto Domingo 18h");
  const [sundayLocation, setSundayLocation] = useState("Auditorio Principal");
  const [thursdayName, setThursdayName] = useState("Campanha da Vitoria");
  const [thursdayLocation, setThursdayLocation] = useState("Auditorio Principal");
  const [thirtyName, setThirtyName] = useState("30 Semanas");
  const [thirtyLocation, setThirtyLocation] = useState("Auditorio Principal");
  const [thirtyStart, setThirtyStart] = useState(toDateTimeInput(nextFriday1930()));
  const [thirtyLimit, setThirtyLimit] = useState("2024-11-21");

  const [manualName, setManualName] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualLocation, setManualLocation] = useState("");

  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startsAt: "", location: "" });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          if (!active) return;
          setError("Sessao expirada. Entre novamente para continuar.");
          setLoadingRole(false);
          setLoadingList(false);
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (!active) return;
        if (profileError) {
          setError(profileError.message);
          setLoadingRole(false);
          setLoadingList(false);
          return;
        }
        const admin = profile?.role === "ADMIN";
        setIsAdmin(admin);
        if (!admin) {
          setEditingId(null);
        }
        setLoadingRole(false);
        if (admin) {
          await cleanupPastCelebrations(admin);
        }
        await fetchCelebrations();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar celebracoes.");
        setLoadingRole(false);
        setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function cleanupPastCelebrations(adminOverride?: boolean) {
    const allowed = typeof adminOverride === "boolean" ? adminOverride : isAdmin;
    if (!allowed) return;
    const response = await fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cleanupPast", payload: { before: new Date().toISOString() } })
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error || "Nao foi possivel limpar celebracoes passadas.");
    }
  }

  async function fetchCelebrations() {
    setLoadingList(true);
    const { data, error } = await supabase.from("celebrations").select("*").order("starts_at");
    if (error) {
      setError(error.message);
      setLoadingList(false);
      return;
    }
    setCelebrations(((data as Celebration[]) ?? []).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
    setLoadingList(false);
  }

  const filteredCelebrations = useMemo(() => {
    const now = Date.now();
    const list = celebrations
      .filter((item) => new Date(item.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter((item) => {
      const when = new Date(item.starts_at).toLocaleString("pt-BR");
      return (
        item.location.toLowerCase().includes(term) ||
        (item.notes ?? "").toLowerCase().includes(term) ||
        when.toLowerCase().includes(term)
      );
    });
  }, [celebrations, search]);

  async function handleGenerateRecurring() {
    const start = parseDate(rangeStart);
    const end = parseDate(rangeEnd);
    const startThirty = parseDateTime(thirtyStart);
    if (!start || !end || !startThirty) {
      setError("Preencha datas validas para gerar os cultos.");
      return;
    }
    if (start > end) {
      setError("O periodo informado esta invertido.");
      return;
    }
    setLoadingGenerate(true);
    setError(null);
    setSuccess(null);

    const items: CelebrationInsert[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const dow = cursor.getDay();
      if (dow === 0) {
        items.push({ starts_at: withTime(cursor, 10, 0).toISOString(), location: sundayLocation, notes: sundayMorningName });
        items.push({ starts_at: withTime(cursor, 18, 0).toISOString(), location: sundayLocation, notes: sundayEveningName });
      }
      if (dow === 4) {
        items.push({ starts_at: withTime(cursor, 20, 0).toISOString(), location: thursdayLocation, notes: thursdayName });
      }
    }

    const limitDate = parseDate(thirtyLimit);
    const limitTimestamp = limitDate ? withTime(limitDate, 23, 59) : null;
    for (let i = 0; i < THIRTY_WEEKS; i += 1) {
      const occurrence = new Date(startThirty);
      occurrence.setDate(startThirty.getDate() + i * 7);
      if (limitTimestamp && occurrence > limitTimestamp) break;
      items.push({ starts_at: occurrence.toISOString(), location: thirtyLocation, notes: thirtyName });
    }

    const existing = new Set(celebrations.map((item) => new Date(item.starts_at).toISOString()));
    const deduped = items.filter((item) => {
      const key = new Date(item.starts_at).toISOString();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    if (!deduped.length) {
      setSuccess("Nenhum novo culto foi adicionado (periodo ja preenchido).");
      setLoadingGenerate(false);
      return;
    }

    const response = await fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulkCreate", payload: { celebrations: deduped } })
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Nao foi possivel gerar os cultos.");
    else {
      setSuccess(`Geramos ${deduped.length} celebracoes automaticamente!`);
      await fetchCelebrations();
    }
    setLoadingGenerate(false);
  }

  async function handleManualCreate() {
    const datetime = parseDateTime(manualDate);
    if (!manualName || !manualLocation || !datetime) {
      setError("Preencha nome, data/hora e local da celebracao pontual.");
      return;
    }
    setLoadingManual(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", payload: { starts_at: datetime.toISOString(), location: manualLocation, notes: manualName } })
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Erro ao adicionar a celebracao.");
    else {
      setSuccess("Celebracao cadastrada com sucesso!");
      setManualName("");
      setManualDate("");
      setManualLocation("");
      await fetchCelebrations();
    }
    setLoadingManual(false);
  }

  function startEdit(item: Celebration) {
    setEditingId(item.id);
    setEditForm({ name: item.notes ?? "", startsAt: toDateTimeInput(new Date(item.starts_at)), location: item.location });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const datetime = parseDateTime(editForm.startsAt);
    if (!datetime) {
      setError("Use data/hora validas na edicao.");
      return;
    }
    setLoadingEdit(true);
    const response = await fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        payload: { id: editingId, starts_at: datetime.toISOString(), location: editForm.location, notes: editForm.name }
      })
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Erro ao salvar alteracoes.");
    else {
      setSuccess("Celebracao atualizada!");
      setEditingId(null);
      await fetchCelebrations();
    }
    setLoadingEdit(false);
  }

  async function handleDelete(id: string) {
    setLoadingDelete(id);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", payload: { id } })
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Nao foi possivel remover a celebracao.");
    else {
      setSuccess("Celebracao removida.");
      await fetchCelebrations();
    }
    setLoadingDelete(null);
  }

  const renderCard = (item: Celebration) => {
    const date = new Date(item.starts_at);
    const day = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const isEditing = editingId === item.id;

    return (
      <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40 transition hover:border-indigo-200/40">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Quando</p>
            <h3 className="text-xl font-semibold text-white">
              {day}  -  {time}
            </h3>
          </div>
          <span className="rounded-full bg-indigo-500/20 px-4 py-1 text-sm font-medium text-indigo-100">Local: {item.location}</span>
        </header>
        <p className="text-sm text-indigo-100/80">
          <span className="font-semibold text-white">Nome:</span> {item.notes ?? "Sem nome definido"}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-indigo-100/70">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">ID  -  {item.id.slice(0, 8).toUpperCase()}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{date.toLocaleString("pt-BR")}</span>
        </div>
        {isEditing ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
                Nome da celebracao
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                Data e hora
                <input
                  type="datetime-local"
                  value={editForm.startsAt}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
                Local
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={loadingEdit}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
              >
                {loadingEdit ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => startEdit(item)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-white/20"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={loadingDelete === item.id}
              className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-rose-100/60"
            >
              {loadingDelete === item.id ? "Removendo..." : "Remover"}
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-indigo-200/80">Area pastoral  -  Celebracoes</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">Agenda de celebracoes</h1>
              <p className="mt-4 max-w-2xl text-sm text-indigo-100/80">
                Gere os cultos regulares e cadastre encontros especiais da Igreja da Cidade Tremembe em poucos cliques.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-indigo-100/80">
              <Link href="/dashboard" className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20">
                Voltar ao painel
              </Link>
              <span className="rounded-full border border-indigo-200/30 bg-indigo-500/20 px-4 py-2 font-semibold text-indigo-100">Uma igreja para pertencer</span>
            </div>
          </div>
        </header>

        {(error || success) && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
            {error && <p className="text-rose-200">Erro: {error}</p>}
            {success && <p className="text-emerald-200">{success}</p>}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-semibold text-white">Gerador automatico</h2>
              <p className="text-sm text-indigo-100/80">
                Domingo 10h e 18h, quinta 20h (campanha) e as 30 semanas nas sextas sao criadas automaticamente dentro do periodo indicado.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs text-indigo-100/80">
              <p>O ciclo 30 Semanas gera {THIRTY_WEEKS} encontros semanais e para automaticamente na data limite definida.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40">
              <h3 className="text-lg font-semibold text-white">Domingos</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Inicio
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Fim
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Nome domingo 10h
                  <input
                    type="text"
                    value={sundayMorningName}
                    onChange={(event) => setSundayMorningName(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Nome domingo 18h
                  <input
                    type="text"
                    value={sundayEveningName}
                    onChange={(event) => setSundayEveningName(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80 sm:col-span-2">
                  Local dos domingos
                  <input
                    type="text"
                    value={sundayLocation}
                    onChange={(event) => setSundayLocation(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40">
              <h3 className="text-lg font-semibold text-white">Quinta e 30 Semanas</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Nome quinta 20h
                  <input
                    type="text"
                    value={thursdayName}
                    onChange={(event) => setThursdayName(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Local quinta
                  <input
                    type="text"
                    value={thursdayLocation}
                    onChange={(event) => setThursdayLocation(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Nome 30 Semanas
                  <input
                    type="text"
                    value={thirtyName}
                    onChange={(event) => setThirtyName(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Local 30 Semanas
                  <input
                    type="text"
                    value={thirtyLocation}
                    onChange={(event) => setThirtyLocation(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Inicio 30 Semanas
                  <input
                    type="datetime-local"
                    value={thirtyStart}
                    onChange={(event) => setThirtyStart(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
                  Limite para encerramento
                  <input
                    type="date"
                    value={thirtyLimit}
                    onChange={(event) => setThirtyLimit(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateRecurring}
              disabled={loadingGenerate}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-indigo-100/60"
            >
              {loadingGenerate ? "Gerando celebracoes..." : "Criar cultos recorrentes"}
            </button>
            <button
              type="button"
              onClick={() => {
                const sunday = nextSunday();
                setRangeStart(toDateInput(sunday));
                setRangeEnd(toDateInput(new Date(sunday.getTime() + 56 * 86400000)));
                setSundayMorningName("Culto Domingo 10h");
                setSundayEveningName("Culto Domingo 18h");
                setSundayLocation("Auditorio Principal");
                setThursdayName("Campanha da Vitoria");
                setThursdayLocation("Auditorio Principal");
                const friday = nextFriday1930();
                setThirtyName("30 Semanas");
                setThirtyLocation("Auditorio Principal");
                setThirtyStart(toDateTimeInput(friday));
                setThirtyLimit("2024-11-21");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20"
            >
              Restaurar padroes
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-semibold text-white">Celebracao pontual</h2>
              <p className="text-sm text-indigo-100/80">Use o formulario para registrar encontros unicos ou tematicos.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {QUICK_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setManualName(name)}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-indigo-100 transition hover:bg-white/20"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
              Nome da celebracao
              <input
                type="text"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Ex.: Conferencia de Mulheres, Vigilia, Culto Eleve"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-indigo-100/80">
              Data e hora
              <input
                type="datetime-local"
                value={manualDate}
                onChange={(event) => setManualDate(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-indigo-100/80 md:col-span-2">
              Local
              <input
                type="text"
                value={manualLocation}
                onChange={(event) => setManualLocation(event.target.value)}
                placeholder="Campus Tremembe, Auditorio principal, Sala multiuso"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleManualCreate}
              disabled={loadingManual}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-emerald-100/60"
            >
              {loadingManual ? "Registrando..." : "Adicionar celebracao"}
            </button>
            <button
              type="button"
              onClick={() => {
                setManualName("");
                setManualDate("");
                setManualLocation("");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/20"
            >
              Limpar formulario
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Agenda cadastrada</h2>
              <p className="text-sm text-indigo-100/80">Filtre por nome, local ou data e ajuste as informacoes conforme necessario.</p>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-sm text-indigo-100/80">
              <span>Buscar</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite nome, local ou data"
                className="w-full bg-transparent text-sm text-white placeholder:text-indigo-100/40 focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-6 space-y-4">
            {loadingList && (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-sm text-indigo-100/70">Carregando celebracoes...</div>
            )}
            {!loadingList && filteredCelebrations.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-sm text-indigo-100/70">
                Nao existem celebracoes futuras cadastradas. Gere novos cultos ou adicione um encontro especial.
              </div>
            )}
            {filteredCelebrations.map(renderCard)}
          </div>
        </section>
      </div>
    </div>
  );
}
