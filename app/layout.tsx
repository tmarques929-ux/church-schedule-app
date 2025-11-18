import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { getServerMessages } from "@lib/i18n/server";
import { I18nProvider } from "@components/I18nProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Escalas da Igreja",
  description: "Gerenciador de escalas para ministerios da igreja",
  manifest: "/manifest.json",
  themeColor: "#312e81"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RootLayoutFallback />}>
      <IntlLayout>{children}</IntlLayout>
    </Suspense>
  );
}

async function IntlLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getServerMessages();
  const skipToContentLabel = messages.common.skipToContent;

  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <a href="#main-content" className="skip-link">
          {skipToContentLabel}
        </a>
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

function RootLayoutFallback() {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <a href="#main-content" className="skip-link">
          Pular para o conteudo principal
        </a>
        <div id="main-content" className="min-h-screen bg-gray-50" />
      </body>
    </html>
  );
}
