import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import CreateUserCard from "./CreateUserCard";
import ChangePasswordCard from "./ChangePasswordCard";

type Profile = {
  name: string | null;
  role: string | null;
};

type QuickCard = {
  href: string;
  emoji: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  gradient: string;
};

type Announcement = {
  icon: string;
  message: string;
};

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
    .maybeSingle<Profile>();

  const currentRole = profile?.role ?? "-";
  const isAdmin = currentRole === "ADMIN";

  const quickCards: QuickCard[] = [
    {
      href: "/dashboard/celebrations",
      emoji: "??",
      badge: "CELEBRATIONS",
      title: "Cultos & celebrações",
      description:
        "Cadastre e acompanhe datas especiais com detalhes de local, horário e notas pastorais.",
      cta: "Abrir agenda ?",
      gradient:
        "from-[#342D7E]/60 via-[#2B275B]/60 to-[#202042]/60 shadow-indigo-900/40 hover:border-[#5446FF]/50"
    },
    {
      href: "/dashboard/availabilities",
      emoji: "??",
      badge: "DISPONIBILIDADES",
      title: "Minhas disponibilidades",
      description: "Atualize quando pode servir e mantenha a equipe informada, evitando conflitos.",
      cta: "Registrar presença ?",
      gradient:
        "from-[#0E647E]/60 via-[#074A63]/60 to-[#05364D]/60 shadow-sky-900/40 hover:border-[#31B4F5]/50"
    },
    {
      href: "/dashboard/schedules",
      emoji: "??",
      badge: "ESCALAS",
      title: "Escalas & equipes",
      description: "Visualize escalas, exporte PDFs/CSVs e acompanhe cada ministério com clareza.",
      cta: "Ver escalas ?",
      gradient:
        "from-[#0F6B4A]/60 via-[#0B5238]/60 to-[#073828]/60 shadow-emerald-900/40 hover:border-[#29D194]/50"
    }
  ];

  const announcements: Announcement[] = [
    {
      icon: "?",
      message: "Revise sua disponibilidade com antecedência para montarmos escalas equilibradas."
    },
    {
      icon: "??",
      message: "Treinamento técnico do setor de áudio neste domingo, às 15h, sala principal."
    },
    { icon: "??", message: "Aproveite o painel para compartilhar feedbacks e celebrar com sua equipe!" }
  ];

  return (
    <div className="min-h-screen bg-[#040615] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#101225]/80 via-[#090B16]/85 to-[#050714]/90 p-10 shadow-[0_40px_120px_-50px_rgba(56,97,251,0.7)]">
          <div className="absolute inset-y-0 right-6 w-32 rounded-full bg-gradient-to-br from-[#3F4CFF]/30 to-[#2EC5CE]/20 blur-3xl" />
          <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-[#5B3BFF]/35 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200/80">
                Igreja da Cidade Tremembé
              </p>
              <h1 className="text-[40px] font-black leading-tight text-white sm:text-[44px]">
                ?? Painel Ministerial – Uma igreja para pertencer
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-indigo-100/85">
                Bem-vindo(a), <span className="font-semibold text-white">{profile?.name ?? "-"}</span>! Aqui você
                acompanha celebrações, disponibilidades e escalas com visual moderno e organizado. Seu papel atual é
                <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-white/90">
                  <span className="text-lg">??</span>
                  {currentRole}
                </span>
                .
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#1D1F3A]/75 via-[#13142A]/85 to-[#0B0D1F]/90 p-6 text-sm text-indigo-50 shadow-[0_35px_90px_-45px_rgba(30,64,175,0.7)]">
              <span className="text-xs uppercase tracking-[0.35em] text-indigo-200/70">Acesso rápido</span>
              <p className="text-lg font-semibold text-white">? Servir é um privilégio</p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#635BFF] to-[#4D9FFF] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:opacity-90"
              >
                ? Voltar ao site principal
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-white/15"
              >
                ?? Sair e trocar usuário
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {quickCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group rounded-3xl border border-white/10 bg-gradient-to-br ${card.gradient} p-6 shadow-xl transition duration-300 hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between text-white">
                <span className="text-3xl">{card.emoji}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/75">
                  {card.badge}
                </span>
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 text-sm text-white/75">{card.description}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition group-hover:text-white">
                {card.cta}
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-8 text-sm text-indigo-100 shadow-[0_30px_90px_-40px_rgba(56,97,251,0.6)]">
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl">???</span>
              <h3 className="text-xl font-semibold">Ações rápidas</h3>
            </div>
            <p className="mt-3 text-indigo-100/80">Navegue com agilidade entre as principais rotinas do ministério.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/celebrations?view=calendar"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-white/20"
              >
                ?? Ver calendário
              </Link>
              <Link
                href="/dashboard/schedules?mode=admin"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-white/20"
              >
                ?? Gerar nova escala
              </Link>
              <Link
                href="/dashboard/availabilities?mode=batch"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-white/20"
              >
                ?? Confirmar equipe
              </Link>
              {isAdmin && (
                <Link
                  href="/dashboard/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                >
                  ??? Área restrita (admins)
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#201D34]/70 via-[#15122A]/80 to-[#0B0A19]/90 p-8 text-sm text-indigo-100 shadow-[0_30px_90px_-50px_rgba(30,64,175,0.6)]">
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl">??</span>
              <h3 className="text-xl font-semibold">Comunicados do ministério</h3>
            </div>
            <ul className="mt-4 space-y-3">
              {announcements.map((item) => (
                <li key={item.message} className="flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-indigo-100/80">{item.message}</span>
                </li>
              ))}
            </ul>
            <Link
              href="mailto:ministerios@icctremembe.com"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5A50F6] to-[#21C1F3] px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:opacity-90"
            >
              ?? Falar com a coordenação
            </Link>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <ChangePasswordCard />
          <CreateUserCard canManageUsers={isAdmin} />
        </div>
      </div>
    </div>
  );
}
