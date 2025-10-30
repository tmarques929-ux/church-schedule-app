ï»¿import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import CreateUserCard from "./CreateUserCard";
import ChangePasswordCard from "./ChangePasswordCard";

export default async function DashboardPage() {
  const supabase = createServerComponentSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-indigo-200/80">Igreja da Cidade TremembÃ©</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">âœ¨ Painel ministerial â€“ Uma igreja para pertencer</h1>
              <p className="mt-4 max-w-2xl text-base text-indigo-100/80">
                Bem-vindo(a), <span className="font-semibold text-white">{profile?.name}</span>! Acompanhe celebraÃ§Ãµes, disponibilidades e escalas em um sÃ³ lugar. Seu papel atual Ã©
                <span className="ml-2 inline-flex rounded-full bg-indigo-500/30 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-indigo-50">{profile?.role ?? "-"}</span>.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-indigo-50">
              <span className="text-xs uppercase tracking-widest text-indigo-200/80">Acesso rÃ¡pido</span>
              <p className="text-lg font-semibold">Servir Ã© um privilÃ©gio âœ¨</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200/30 bg-indigo-500/80 px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
              >
                â† Voltar ao site principal
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Trocar usuÃ¡rio
              </Link>
            </div>
          </div>
        </header>

        <CreateUserCard canManageUsers={profile?.role === "ADMIN"} />
        <ChangePasswordCard />

        <section className="grid gap-6 md:grid-cols-3">
          <Link
            href="/dashboard/celebrations"
            className="group rounded-2xl border border-white/10 bg-gradient-to-b from-indigo-500/20 via-indigo-500/10 to-blue-500/10 p-6 shadow-lg shadow-indigo-900/20 transition hover:-translate-y-1 hover:border-indigo-300/50 hover:bg-indigo-500/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">ðŸŽ‰</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100">Celebrations</span>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">Cultos e celebraÃ§Ãµes</h2>
            <p className="mt-2 text-sm text-indigo-100/80">Cadastre e acompanhe datas especiais com detalhes de local, horÃ¡rio e notas pastorais.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-100/90">Abrir agenda â†’</span>
          </Link>

          <Link
            href="/dashboard/availabilities"
            className="group rounded-2xl border border-white/10 bg-gradient-to-b from-cyan-500/20 via-cyan-500/10 to-sky-500/10 p-6 shadow-lg shadow-sky-900/20 transition hover:-translate-y-1 hover:border-cyan-300/50 hover:bg-cyan-500/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">ðŸ—“ï¸</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">Disponibilidades</span>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">Minhas disponibilidades</h2>
            <p className="mt-2 text-sm text-cyan-100/80">Atualize quando pode servir e mantenha a equipe informada.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100/90">Registrar presenÃ§a â†’</span>
          </Link>

          <Link
            href="/dashboard/schedules"
            className="group rounded-2xl border border-white/10 bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-teal-500/10 p-6 shadow-lg shadow-emerald-900/20 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-emerald-500/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">ðŸ“‹</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">Escalas</span>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">Escalas e equipes</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Visualize escalas, exporte PDFs/CSVs e acompanhe cada ministÃ©rio com clareza.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-100/90">Ver escalas â†’</span>
          </Link>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">âš¡</span>
              <h3 className="text-xl font-semibold text-white">AÃ§Ãµes rÃ¡pidas</h3>
            </div>
            <p className="mt-3 text-sm text-indigo-100/80">Navegue com agilidade entre as principais rotinas do ministÃ©rio.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/celebrations?view=calendar"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Ver calendÃ¡rio
              </Link>
              <Link
                href="/dashboard/schedules?mode=admin"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Gerar nova escala
              </Link>
              <Link
                href="/dashboard/availabilities?mode=batch"
                className="inline-flex items_center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Confirmar equipe
              </Link>
              {profile?.role === "ADMIN" && (
                <Link
                  href="/dashboard/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                >
                  Ãrea restrita (admins)
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-indigo-900/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ðŸ“£</span>
              <h3 className="text-xl font-semibold text-white">Comunicados do ministÃ©rio</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-indigo-100/80">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-lg">âœ…</span>
                <span>Revise sua disponibilidade com antecedÃªncia para montarmos escalas equilibradas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-lg">ðŸŽ§</span>
                <span>Treinamento tÃ©cnico do setor de Ã¡udio neste domingo Ã s 15h, sala principal.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-lg">â¤ï¸</span>
                <span>Aproveite o painel para compartilhar feedbacks e celebrar com sua equipe!</span>
              </li>
            </ul>
            <Link
              href="mailto:ministerios@icctremembe.com"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-indigo-500/80 px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
            >
              Falar com a coordenaÃ§Ã£o
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
