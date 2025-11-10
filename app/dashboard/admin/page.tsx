import { Suspense } from "react";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { createTranslator } from "next-intl";
import Link from "next/link";
import { getServerTranslator } from "@lib/i18n/server";
import ScheduleGeneratorCard from "../ScheduleGeneratorCard";
import ResetPasswordCard from "../ResetPasswordCard";
import UpdateUsernameCard from "../UpdateUsernameCard";
import AdminMinistryAssignmentsCard from "./AdminMinistryAssignmentsCard";
import AdminMinistryDirectoryCard from "./AdminMinistryDirectoryCard";
import AdminAvailabilitiesOverviewCard from "./AdminAvailabilitiesOverviewCard";
import AdminFamilyLinkCard from "./AdminFamilyLinkCard";
import AdminInsightsDashboardCard from "./AdminInsightsDashboardCard";

export default function AdminAreaPage() {
  return (
    <AdminAreaLayout>
      <Suspense fallback={<AdminAreaFallback />}>
        <AdminAreaContent />
      </Suspense>
    </AdminAreaLayout>
  );
}

function AdminAreaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">{children}</div>
    </div>
  );
}

function AdminAreaFallback() {
  return (
    <>
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
        <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <p className="h-3 w-48 rounded-full bg-indigo-200/20" />
            <div className="h-8 w-72 rounded-full bg-white/20" />
            <p className="h-16 max-w-2xl rounded-2xl bg-indigo-100/10" />
          </div>
          <div className="flex flex-col gap-3 text-sm text-indigo-100/80">
            <span className="h-3 w-40 rounded-full bg-indigo-200/20" />
            <span className="inline-flex h-9 w-56 items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold text-transparent">
              &nbsp;
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <span className="inline-flex h-10 w-72 items-center rounded-full border border-indigo-300/40 bg-indigo-500/40 px-4 py-2 text-sm font-semibold text-transparent">
          &nbsp;
        </span>
      </div>

      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`admin-area-skeleton-${index}`}
            className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5 shadow-lg shadow-indigo-900/20"
          />
        ))}
      </div>
    </>
  );
}

async function AdminAreaContent() {
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
    .select("name, role, username")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const metadata = (user.user_metadata as { username?: string } | null) ?? null;
  const username = (profile.username ?? metadata?.username ?? "").trim().toLowerCase();
  const isPrimaryAdmin = username === "thiagomrib";
  const memberName = profile.name?.trim();
  const { locale, messages, t } = await getServerTranslator("admin");
  const commonT = createTranslator({ locale, messages, namespace: "common" });
  const fallbackName = commonT("placeholders.unknownName");
  const displayName = isPrimaryAdmin ? "Thiago Marques Ribeiro" : memberName || user.email || fallbackName;
  const accessLabel = t("accessLabel", { name: displayName });
  const backToDashboardLabel = commonT("actions.backToDashboard");
  const manageVolunteersLabel = t("chips.manageVolunteers");

  return (
    <>
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-indigo-900/20 backdrop-blur">
        <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-indigo-200/80">{t("header.badge")}</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">{t("header.title")}</h1>
            <p className="mt-4 max-w-2xl text-base text-indigo-100/80">{t("header.description")}</p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-indigo-100/80">
            <span className="text-xs uppercase tracking-widest text-indigo-200/80">{accessLabel}</span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
            >
              {backToDashboardLabel}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/admin/members"
          className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
        >
          {manageVolunteersLabel}
        </Link>
      </div>

      <AdminInsightsDashboardCard />

      <ScheduleGeneratorCard />
      <ResetPasswordCard />
      <UpdateUsernameCard />
      <AdminMinistryAssignmentsCard />
      <AdminFamilyLinkCard />
      <AdminMinistryDirectoryCard />
      <AdminAvailabilitiesOverviewCard />
    </>
  );
}

