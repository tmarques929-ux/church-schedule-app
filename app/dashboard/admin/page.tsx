import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentSupabaseClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import ScheduleGeneratorCard from '../ScheduleGeneratorCard';
import ResetPasswordCard from '../ResetPasswordCard';
import MemberAssignmentsSearchCard from "../schedules/MemberAssignmentsSearchCard";
import UpdateUsernameCard from "../UpdateUsernameCard";
import AdminMinistryAssignmentsCard from "./AdminMinistryAssignmentsCard";
import AdminMinistryDirectoryCard from "./AdminMinistryDirectoryCard";
import AdminAvailabilitiesOverviewCard from "./AdminAvailabilitiesOverviewCard";


export default async function AdminAreaPage() {
  const supabase = createServerComponentSupabaseClient({ cookies, headers });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
          <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-indigo-200/80">Area restrita para lideranca</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">Central administrativa</h1>
              <p className="mt-4 max-w-2xl text-base text-indigo-100/80">
                Gerencie escalas, senhas e acompanhe o cronograma de cada voluntario. Este espaco e exclusivo para administradores.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-indigo-100/80">
              <span className="text-xs uppercase tracking-widest text-indigo-200/80">Acesso de {profile.name}</span>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
              >
                Voltar ao painel principal
              </Link>
            </div>
          </div>
        </header>

        <ScheduleGeneratorCard />
        <ResetPasswordCard />
        <UpdateUsernameCard />
        <AdminMinistryAssignmentsCard />
        <AdminMinistryDirectoryCard />
        <AdminAvailabilitiesOverviewCard />
        <MemberAssignmentsSearchCard />
      </div>
    </div>
  );
}
