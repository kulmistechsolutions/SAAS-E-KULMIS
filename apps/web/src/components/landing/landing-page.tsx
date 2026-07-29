"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MessageCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { TranslationKey } from "@/lib/i18n/provider";

const WHATSAPP_NUMBER = "252613945791";
const WHATSAPP_DISPLAY = "+252 61 3945791";
const CONTACT_EMAIL = "info@ekulmis.com";

const MODULES: { icon: typeof Users; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Users, titleKey: "landing.module1Title", descKey: "landing.module1Desc" },
  { icon: GraduationCap, titleKey: "landing.module2Title", descKey: "landing.module2Desc" },
  { icon: ClipboardList, titleKey: "landing.module3Title", descKey: "landing.module3Desc" },
  { icon: CalendarCheck, titleKey: "landing.module4Title", descKey: "landing.module4Desc" },
  { icon: Banknote, titleKey: "landing.module5Title", descKey: "landing.module5Desc" },
  { icon: MessageCircle, titleKey: "landing.module6Title", descKey: "landing.module6Desc" },
  { icon: TrendingUp, titleKey: "landing.module7Title", descKey: "landing.module7Desc" },
  { icon: LayoutDashboard, titleKey: "landing.module8Title", descKey: "landing.module8Desc" },
];

export function LandingPage({ rootDomain }: { rootDomain: string }) {
  const t = useT();

  return (
    <main className="min-h-screen bg-secondary/20">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <Image
            src="/ekulmis-logo.png"
            alt="eKulmis"
            width={188}
            height={56}
            className="h-9 w-auto object-contain sm:h-10"
            priority
          />
          <LanguageSwitcher />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-8 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t("landing.heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/results"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t("landing.lookUpResult")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8 sm:pb-24">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t("landing.previewTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("landing.previewSubtitle")}</p>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card p-2 shadow-lg sm:p-3">
          <Image
            src="/ekulmis-dashboard-preview.png"
            alt="eKulmis dashboard"
            width={1400}
            height={748}
            className="w-full rounded-xl border"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 sm:pb-24">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">{t("landing.featuresTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("landing.featuresSubtitle")}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div
              key={m.titleKey}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold">{t(m.titleKey)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(m.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-8">
          <h2 className="text-xl font-bold">{t("landing.schoolSectionTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("landing.schoolSectionBody")}{" "}
            <span className="font-mono">yourschool.{rootDomain}</span>.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 p-8 text-center text-white shadow-lg sm:p-12">
          <h2 className="text-2xl font-bold">{t("landing.contactTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85 sm:text-base">
            {t("landing.contactSubtitle")}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-indigo-700 shadow-sm transition-transform hover:scale-[1.03]"
            >
              <MessageCircle className="h-4 w-4" />
              {t("landing.whatsappUs")} · {WHATSAPP_DISPLAY}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] hover:bg-white/20"
            >
              <Mail className="h-4 w-4" />
              {t("landing.emailUs")} · {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <footer className="space-y-1 px-4 py-8 text-center text-xs text-muted-foreground">
        <p className="font-medium">{t("landing.developedBy")}</p>
        <p>© {new Date().getFullYear()} eKulmis. {t("landing.rights")}</p>
      </footer>
    </main>
  );
}
