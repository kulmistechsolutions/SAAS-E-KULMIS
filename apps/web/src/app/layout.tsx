import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, dirOf, toLang, type Lang } from "@/lib/i18n/config";
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

/**
 * A visitor's first-ever request has no language cookie yet — falling back to
 * DEFAULT_LANG ("en") meant every school whose staff work in Somali or
 * Arabic saw an English login page until someone thought to use the
 * language switcher. The school's own preferred language (set in Settings →
 * School Information, already stored as School.language) is fetched here
 * from the public branding endpoint — middleware already resolves and
 * forwards the tenant subdomain, so this needs no extra tenant lookup of
 * its own. Only used when there is no cookie; an explicit choice always wins.
 */
async function resolveSchoolDefaultLang(): Promise<Lang> {
  try {
    const subdomain = (await headers()).get("x-tenant-subdomain");
    if (!subdomain) return "en";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiUrl}/api/settings/branding`, {
      headers: { "x-tenant-subdomain": subdomain },
      // Short-lived cache: a school's language rarely changes, but a fresh
      // change should reach new anonymous visitors within a few minutes.
      next: { revalidate: 300 },
    });
    if (!res.ok) return "en";
    const data: unknown = await res.json();
    const language =
      data && typeof data === "object" && "language" in data
        ? (data as { language: unknown }).language
        : undefined;
    return toLang(language);
  } catch {
    return "en";
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Read on the server so lang and dir are right in the first response.
  // Deciding this on the client instead would render Arabic left-to-right
  // until hydration and then jump.
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = cookieLang ? toLang(cookieLang) : await resolveSchoolDefaultLang();

  return (
    <html lang={lang} dir={dirOf(lang)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers lang={lang}>{children}</Providers>
        <PwaInstaller />
      </body>
    </html>
  );
}
