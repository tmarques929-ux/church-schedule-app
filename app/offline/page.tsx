import type { Metadata } from "next";
import Link from "next/link";
import { getServerTranslator } from "@lib/i18n/server";

export const metadata: Metadata = {
  title: "Offline"
};

export default async function OfflinePage() {
  const { t } = await getServerTranslator("common");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-12 text-slate-100"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl font-bold text-white">
          !
        </div>
        <h1 className="text-2xl font-semibold">{t("offline.title")}</h1>
        <p className="mt-3 text-sm text-indigo-100/80">{t("offline.description")}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          {t("offline.action")}
        </Link>
      </div>
    </main>
  );
}
