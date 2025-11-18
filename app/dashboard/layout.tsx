import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import LogoutButton from "./LogoutButton";
import ScrollToTopButton from "./ScrollToTopButton";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
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
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.name ?? user.email ?? "Voluntario";

  return (
    <div className="relative min-h-screen">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-sm text-indigo-100">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.35em] text-indigo-200/70">Usuario atual</span>
            <span className="text-sm font-semibold text-white">{displayName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-white/20"
            >
              Voltar ao painel
            </Link>
            <Link
              href="/dashboard/my-ministries"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-indigo-100 transition hover:bg-white/20"
            >
              Meus ministerios
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="pt-20 md:pt-24">
        {children}
      </main>
      <ScrollToTopButton />
    </div>
  );
}
