"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { localeLabels, supportedLocales } from "@lib/i18n";
import { useI18nLocale, useI18nTranslations } from "@components/I18nProvider";

type LocaleSwitcherProps = {
  size?: "sm" | "md";
  className?: string;
};

const sizeMap = {
  sm: {
    label: "text-[0.6rem] tracking-[0.4em]",
    select: "text-xs px-3 py-1.5 h-9"
  },
  md: {
    label: "text-xs tracking-[0.4em]",
    select: "text-sm px-4 py-2.5 h-11"
  }
} as const;

export default function LocaleSwitcher({ size = "md", className = "" }: LocaleSwitcherProps) {
  const t = useI18nTranslations("common.locale");
  const locale = useI18nLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const styles = sizeMap[size] ?? sizeMap.md;

  async function handleChange(nextLocale: string) {
    startTransition(async () => {
      try {
        await fetch("/api/i18n/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: nextLocale })
        });
      } catch (error) {
        console.error("Failed to switch locale", error);
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <label className={`flex flex-col gap-2 uppercase text-indigo-200/80 ${styles.label} ${className}`}>
      <span>{t("label")}</span>
      <div className="relative">
        <select
          className={`w-full appearance-none rounded-full border border-white/15 bg-white/10 text-white shadow-inner shadow-black/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${styles.select}`}
          value={locale}
          onChange={(event) => handleChange(event.target.value)}
          aria-label={t("ariaLabel")}
          disabled={isPending}
        >
          {supportedLocales.map((code) => (
            <option key={code} value={code} className="bg-slate-900 text-white">
              {localeLabels[code]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/70">v</span>
      </div>
      {isPending && (
        <span className="text-[0.65rem] text-indigo-100/70" aria-live="polite">
          {t("updating")}
        </span>
      )}
    </label>
  );
}
