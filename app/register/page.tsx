import { getServerTranslator } from "@lib/i18n/server";

export default async function RegisterPage() {
  const { t } = await getServerTranslator("register");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-slate-950"
    >
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-100 shadow-xl shadow-slate-900/40">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-4 text-sm text-slate-200/80">{t("description")}</p>
      </div>
    </main>
  );
}
