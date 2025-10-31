import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";

type RawAssignment = {
  ministry_id: string | null;
  is_leader: boolean | null;
  ministries: {
    id: string | null;
    name: string | null;
    description: string | null;
    active: boolean | null;
  } | null;
};

type MinistryAssignment = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  isLeader: boolean;
};

export default async function MyMinistriesPage() {
  const supabase = createServerComponentSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: assignmentsData, error: assignmentsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("member_ministries")
      .select("ministry_id, is_leader, ministries(id, name, description, active)")
      .eq("member_id", user.id)
  ]);

  const fetchErrorMessage = assignmentsError?.message ?? null;

  const assignments: MinistryAssignment[] =
    fetchErrorMessage || !assignmentsData
      ? []
      : (assignmentsData as RawAssignment[]).map((item) => {
          const ministry = item.ministries;
          const id = ministry?.id ?? item.ministry_id ?? "sem-id";
          const name = ministry?.name?.trim() || "Ministerio sem nome";
          return {
            id,
            name,
            description: ministry?.description ?? null,
            active: Boolean(ministry?.active),
            isLeader: Boolean(item.is_leader)
          };
        });

  assignments.sort((a, b) => {
    if (a.isLeader !== b.isLeader) {
      return a.isLeader ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const activeCount = assignments.filter((item) => item.active).length;
  const leaderCount = assignments.filter((item) => item.isLeader).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-indigo-900/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/70">
                Meu lugar de servico
              </p>
              <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Ministerios que participo</h1>
              <p className="mt-3 max-w-xl text-sm text-indigo-100/80">
                {profile?.name ? `Ola, ${profile.name}! ` : "Ola! "}
                Aqui voce encontra os ministerios vinculados a sua conta. Somente administradores podem alterar
                essas atribuicoes; fale com a lideranca caso precise de ajustes.
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-4 text-xs text-indigo-100/80">
              <p>Total de ministerios: {assignments.length}</p>
              <p>Ministerios ativos: {activeCount}</p>
              <p>Liderancas: {leaderCount}</p>
            </div>
          </div>
        </header>

        {fetchErrorMessage ? (
          <section className="rounded-3xl border border-rose-300/30 bg-rose-500/20 p-8 text-sm text-rose-100">
            <p>Ocorreu um erro ao carregar seus ministerios: {fetchErrorMessage}.</p>
            <p className="mt-3">
              Tente novamente em instantes. Caso o problema continue, procure a lideranca ou envie um email para{" "}
              <a href="mailto:tmarques9@hotmail.com" className="text-rose-50 underline">
                tmarques9@hotmail.com
              </a>
              .
            </p>
          </section>
        ) : assignments.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-8 text-sm text-indigo-100/80">
            <p>
              Nenhum ministerio foi associado a sua conta ainda. Se voce acredita que isso e um engano,
              procure sua lideranca ou envie um email para{" "}
              <a href="mailto:tmarques9@hotmail.com" className="text-indigo-200 underline">
                tmarques9@hotmail.com
              </a>
              .
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {assignments.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-inner shadow-black/40"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{assignment.name}</h2>
                    {assignment.description && (
                      <p className="mt-2 max-w-2xl text-sm text-indigo-100/80">{assignment.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-100/80">
                    <span
                      className={`rounded-full border px-3 py-1 ${
                        assignment.active
                          ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                          : "border-rose-300/40 bg-rose-500/20 text-rose-100"
                      }`}
                    >
                      {assignment.active ? "Ativo" : "Inativo"}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
                      {assignment.isLeader ? "Lideranca" : "Participante"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <footer className="flex flex-wrap items-center gap-3 text-sm text-indigo-100/80">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
          >
            Voltar ao painel
          </Link>
          <span className="text-xs text-indigo-100/60">
            Precisa alterar algo? Apenas administradores podem atualizar ministerios vinculados.
          </span>
        </footer>
      </div>
    </div>
  );
}
