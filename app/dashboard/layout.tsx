import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import LogoutButton from "./LogoutButton";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = createServerComponentSupabaseClient({ cookies, headers });
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
          <LogoutButton />
        </div>
      </header>
      <main className="pt-20 md:pt-24">{children}</main>
    </div>
  );
}
