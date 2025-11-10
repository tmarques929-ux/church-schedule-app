import { NextResponse } from "next/server";
import { LOCALE_COOKIE, resolveLocale } from "@lib/i18n";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const requestedLocale =
    typeof (payload as { locale?: unknown } | null)?.locale === "string"
      ? (payload as { locale?: string }).locale
      : null;

  const locale = resolveLocale(requestedLocale);
  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS
  });
  return response;
}
