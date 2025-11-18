"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { createTranslator } from "next-intl";

type MessagesObject = Record<string, unknown>;

type I18nContextValue = {
  locale: string;
  messages: MessagesObject;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children
}: {
  locale: string;
  messages: MessagesObject;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, messages }),
    [locale, messages]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("I18n context is unavailable. Wrap components with <I18nProvider>.");
  }
  return context;
}

export function useI18nLocale() {
  return useI18nContext().locale;
}

export function useI18nTranslations(namespace?: string) {
  const { locale, messages } = useI18nContext();
  return useMemo(
    () => createTranslator({ locale, messages, namespace }),
    [locale, messages, namespace]
  );
}
