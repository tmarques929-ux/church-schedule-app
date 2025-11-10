import type ptBRMessages from "../../messages/pt-BR.json";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const supportedLocales = ["pt-BR", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "pt-BR";

export const localeLabels: Record<Locale, string> = {
  "pt-BR": "Portugues (Brasil)",
  en: "English"
};

type Messages = typeof ptBRMessages;

const dictionaries: Record<Locale, () => Promise<Messages>> = {
  "pt-BR": () => import("../../messages/pt-BR.json").then((module) => module.default as Messages),
  en: () => import("../../messages/en.json").then((module) => module.default as Messages)
};

export function resolveLocale(locale?: string | null): Locale {
  if (!locale) {
    return defaultLocale;
  }
  const normalized = locale.trim();
  const exactMatch = supportedLocales.find((entry) => entry.toLowerCase() === normalized.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const langOnly = normalized.split(/[-_]/)[0];
  const partialMatch = supportedLocales.find((entry) => entry.startsWith(langOnly));
  return partialMatch ?? defaultLocale;
}

export async function getMessages(locale: Locale): Promise<Messages> {
  const fetchDictionary = dictionaries[locale] ?? dictionaries[defaultLocale];
  return fetchDictionary();
}
