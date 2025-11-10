'use server';

import { cookies } from 'next/headers';
import { createTranslator } from 'next-intl';
import { getMessages, resolveLocale, LOCALE_COOKIE } from '.';
import type { Locale } from '.';

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function getServerMessages() {
  const locale = await getServerLocale();
  const messages = await getMessages(locale);
  return { locale, messages };
}

export async function getServerTranslator(namespace?: string) {
  const { locale, messages } = await getServerMessages();
  const t = createTranslator({ locale, messages, namespace });
  return { locale, messages, t };
}
