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

type BirthdayProfile = {
  user_id: string;
  name: string | null;
  username: string | null;
  birth_date: string | null;
};

type BirthdayHighlight = {
  id: string;
  name: string;
  username: string | null;
  ageText: string | null;
};

type MonthBirthdayHighlight = BirthdayHighlight & {
  day: number;
  dateLabel: string;
  isToday: boolean;
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const supabase = createServerComponentSupabaseClient({
    cookies: () => cookieStore,
    headers: () => headerList
  });
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
  let birthdayFeatureEnabled = true;
  let birthdayLoadError: string | null = null;
  let monthBirthdays: MonthBirthdayHighlight[] = [];
  let todaysBirthdays: MonthBirthdayHighlight[] = [];

  try {
    const { data: birthdayRows, error: birthdaysError } = await supabase
      .from("profiles")
      .select<BirthdayProfile>("user_id, name, username, birth_date")
      .not("birth_date", "is", null);

    if (birthdaysError) {
      if (birthdaysError.message?.toLowerCase().includes("birth_date")) {
        birthdayFeatureEnabled = false;
      } else {
        throw birthdaysError;
      }
      } else if (birthdayRows) {
        const today = new Date();
        const todayMonth = today.getUTCMonth() + 1;
        const todayDay = today.getUTCDate();
        const currentYear = today.getUTCFullYear();
        const paddedMonth = String(todayMonth).padStart(2, "0");
        monthBirthdays = birthdayRows
          .map((candidate) => {
            if (!candidate.birth_date) {
              return null;
            }
            const [yearStr, monthStr, dayStr] = candidate.birth_date.split("-");
            const month = Number(monthStr);
            const day = Number(dayStr);
            if (!Number.isFinite(month) || !Number.isFinite(day) || month !== todayMonth) {
              return null;
            }
            const year = Number(yearStr);
            const usernameLabel = candidate.username?.trim() ?? null;
            const normalizedUsername = usernameLabel ? usernameLabel.toLowerCase() : null;
            const resolvedName = candidate.name?.trim();
            const displayName =
              normalizedUsername === "thiagomrib"
                ? "Thiago Marques Ribeiro"
                : resolvedName && resolvedName.length > 0
                ? resolvedName
                : usernameLabel ?? "Voluntario";
            const age = Number.isFinite(year) && year > 0 ? currentYear - year : null;
            const ageText = age && age > 0 ? `${age} anos` : null;
            const isToday = day === todayDay;
            return {
              id: candidate.user_id,
              name: displayName,
              username: usernameLabel,
              ageText,
              day,
              isToday,
              dateLabel: `${String(day).padStart(2, "0")}/${paddedMonth}`
            } as MonthBirthdayHighlight;
          })
          .filter((item): item is MonthBirthdayHighlight => Boolean(item))
          .sort((a, b) => {
            if (a.day === b.day) {
              return a.name.localeCompare(b.name, "pt-BR");
            }
            return a.day - b.day;
          });
        todaysBirthdays = monthBirthdays.filter((entry) => entry.isToday);
      }
  } catch (err) {
    birthdayLoadError = "Nao foi possivel carregar os aniversariantes. Tente novamente mais tarde.";
  }

  const quickCards: QuickCard[] = [
    {
      href: "/dashboard/celebrations",
      emoji: "🎉",
      badge: "CELEBRATIONS",
      title: "Cultos & celebrações",
      description:
        "Cadastre e acompanhe datas especiais com detalhes de local, horário e notas pastorais.",
      cta: "Abrir agenda ✨",
      gradient:
        "from-[#342D7E]/60 via-[#2B275B]/60 to-[#202042]/60 shadow-indigo-900/40 hover:border-[#5446FF]/50"
    },
    {
      href: "/dashboard/availabilities",
      emoji: "🗓️",
      badge: "DISPONIBILIDADES",
      title: "Minhas disponibilidades",
      description: "Atualize quando pode servir e mantenha a equipe informada, evitando conflitos.",
      cta: "Registrar presença 🙋",
      gradient:
        "from-[#0E647E]/60 via-[#074A63]/60 to-[#05364D]/60 shadow-sky-900/40 hover:border-[#31B4F5]/50"
    },
    {
      href: "/dashboard/schedules",
      emoji: "👥",
      badge: "ESCALAS",
      title: "Escalas & equipes",
      description: "Visualize escalas, exporte PDFs/CSVs e acompanhe cada ministério com clareza.",
      cta: "Ver escalas 📋",
      gradient:
        "from-[#0F6B4A]/60 via-[#0B5238]/60 to-[#073828]/60 shadow-emerald-900/40 hover:border-[#29D194]/50"
    }
  ];

  const announcements: Announcement[] = [
    {
      icon: "📌",
      message: "Revise sua disponibilidade com antecedência para montarmos escalas equilibradas."
    },
    {
      icon: "🎧",
      message: "Treinamento técnico do setor de áudio neste domingo, às 15h, sala principal."
    },
    { icon: "💬", message: "Aproveite o painel para compartilhar feedbacks e celebrar com sua equipe!" }
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
                ✨ Painel Ministerial – Uma igreja para pertencer
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-indigo-100/85">
                Bem-vindo(a), <span className="font-semibold text-white">{profile?.name ?? "-"}</span>! Aqui você
                acompanha celebrações, disponibilidades e escalas com visual moderno e organizado. Seu papel atual é
                <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-white/90">
                  <span className="text-lg">🎖️</span>
                  {currentRole}
                </span>
                .
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#1D1F3A]/75 via-[#13142A]/85 to-[#0B0D1F]/90 p-6 text-sm text-indigo-50 shadow-[0_35px_90px_-45px_rgba(30,64,175,0.7)]">
              <span className="text-xs uppercase tracking-[0.35em] text-indigo-200/70">Acesso rápido</span>
              <p className="text-lg font-semibold text-white">🙏 Servir é um privilégio</p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#635BFF] to-[#4D9FFF] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:opacity-90"
              >
                🏠 Voltar ao site principal
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-white/15"
              >
                🔄 Sair e trocar usuário
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

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B1230]/80 via-[#110A21]/85 to-[#06030F]/90 p-8 text-sm text-indigo-100 shadow-[0_35px_120px_-60px_rgba(124,58,237,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎂</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-200/70">Celebre hoje</p>
                <h3 className="text-xl font-semibold">Aniversariantes do dia</h3>
              </div>
            </div>
            {todaysBirthdays.length > 0 && (
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold text-white/80">
                {todaysBirthdays.length === 1
                  ? "1 voluntario celebrando"
                  : `${todaysBirthdays.length} voluntarios celebrando`}
              </span>
            )}
          </div>
          {!birthdayFeatureEnabled ? (
            <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
              Este painel precisa da coluna <code className="mx-1 rounded bg-amber-300/20 px-1 py-0.5 text-xs font-mono">birth_date</code> em
              <code className="mx-1 rounded bg-amber-300/20 px-1 py-0.5 text-xs font-mono">profiles</code>. Execute a migration para habilitar os aniversariantes.
            </p>
          ) : birthdayLoadError ? (
            <p className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
              {birthdayLoadError}
            </p>
          ) : todaysBirthdays.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/80">
              Nenhum aniversariante cadastrado para hoje. Atualize os perfis e compartilhe esse momento com a equipe.
            </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {todaysBirthdays.map((birthday) => (
                  <li
                    key={birthday.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-white">{birthday.name}</p>
                    <p className="text-xs text-indigo-100/70">
                      {birthday.username ? `@${birthday.username}` : "Sem username cadastrado"}
                    </p>
                  </div>
                  <div className="text-sm text-indigo-100/80 sm:text-right">
                    <p className="font-semibold text-white">{birthday.ageText ?? "Feliz aniversario"}</p>
                    <p className="text-xs text-indigo-100/70">Envie uma mensagem e celebre juntos</p>
                  </div>
                  </li>
                ))}
              </ul>
            )}
            {birthdayFeatureEnabled && !birthdayLoadError && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-white">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-indigo-200/70">
                      Celebre este mês
                    </p>
                    <h4 className="text-lg font-semibold">Aniversariantes do mês</h4>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold text-white/80">
                    {monthBirthdays.length === 1
                      ? "1 voluntario"
                      : `${monthBirthdays.length} voluntarios`}
                  </span>
                </div>
                {monthBirthdays.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/80">
                    Nao ha aniversariantes cadastrados para este mes. Atualize os perfis para aproveitar este painel.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {monthBirthdays.map((birthday) => (
                      <li
                        key={`month-birthday-${birthday.id}-${birthday.day}`}
                        className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm text-white sm:flex-row sm:items-center sm:justify-between ${
                          birthday.isToday
                            ? "border-indigo-300/60 bg-indigo-500/15 shadow-inner shadow-indigo-900/30"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-200/80">
                            {birthday.dateLabel}
                          </span>
                          <div>
                            <p className="font-semibold text-white">{birthday.name}</p>
                            <p className="text-[0.7rem] text-indigo-100/70">
                              {birthday.username ? `@${birthday.username}` : "Sem username cadastrado"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-1 text-xs text-indigo-100/80 sm:items-end">
                          {birthday.isToday && (
                            <span className="inline-flex items-center rounded-full border border-indigo-300/50 bg-indigo-500/30 px-3 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-white">
                              Hoje
                            </span>
                          )}
                          <span className="text-sm font-semibold text-white">
                            {birthday.ageText ?? "Celebrando mais um ano"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-8 text-sm text-indigo-100 shadow-[0_30px_90px_-40px_rgba(56,97,251,0.6)]">
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl">🔒</span>
              <h3 className="text-xl font-semibold">Área restrita administrativa</h3>
            </div>
            <p className="mt-3 text-indigo-100/80">
              Ferramentas exclusivas para liderança monitorar escalas, voluntários e comunicados internos.
            </p>
            {isAdmin ? (
              <Link
                href="/dashboard/admin"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-5 py-3 font-semibold text-indigo-50 transition hover:bg-indigo-500/30"
              >
                Acessar central administrativa
              </Link>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-indigo-100/80">
                Disponível apenas para administradores. Solicite autorização à sua liderança para atuar na gestão das escalas.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#201D34]/70 via-[#15122A]/80 to-[#0B0A19]/90 p-8 text-sm text-indigo-100 shadow-[0_30px_90px_-50px_rgba(30,64,175,0.6)]">
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl">📣</span>
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
