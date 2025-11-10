const { getRequestConfig } = require("next-intl/server");

const supportedLocales = ["pt-BR", "en"];
const defaultLocale = "pt-BR";

function resolveLocale(locale) {
  if (!locale) return defaultLocale;
  const normalized = locale.trim();
  const exactMatch = supportedLocales.find((entry) => entry.toLowerCase() === normalized.toLowerCase());
  if (exactMatch) return exactMatch;
  const langOnly = normalized.split(/[-_]/)[0];
  const partialMatch = supportedLocales.find((entry) => entry.startsWith(langOnly));
  return partialMatch ?? defaultLocale;
}

module.exports = getRequestConfig(async ({ locale }) => {
  const normalizedLocale = resolveLocale(locale);
  const messages = (await import(`./messages/${normalizedLocale}.json`)).default;

  return {
    defaultLocale,
    locales: supportedLocales,
    locale: normalizedLocale,
    messages
  };
});
