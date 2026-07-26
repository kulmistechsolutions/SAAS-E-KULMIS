import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, dirOf, toLang } from "@/lib/i18n/config";
import { BRAND } from "@/lib/brand";
import { PwaInstaller } from "@/components/pwa/pwa-installer";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.pageTitle,
  description: BRAND.description,
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Read on the server so lang and dir are right in the first response.
  // Deciding this on the client instead would render Arabic left-to-right
  // until hydration and then jump.
  const lang = toLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={lang} dir={dirOf(lang)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers lang={lang}>{children}</Providers>
        <PwaInstaller />
      </body>
    </html>
  );
}
