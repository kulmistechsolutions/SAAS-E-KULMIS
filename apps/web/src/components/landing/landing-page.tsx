"use client";

import Image from "next/image";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  ClipboardList,
  Cloud,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import type { TranslationKey } from "@/lib/i18n/provider";

const WHATSAPP_NUMBER = "252613945791";
const WHATSAPP_DISPLAY = "+252 61 3945791";
const CONTACT_EMAIL = "info@ekulmis.com";

type Item = {
  icon: typeof Users;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  tone: string;
};

const TRUST: Item[] = [
  { icon: Cloud, titleKey: "landing.trust1Title", descKey: "landing.trust1Desc", tone: "text-sky-600 bg-sky-500/10" },
  { icon: ShieldCheck, titleKey: "landing.trust2Title", descKey: "landing.trust2Desc", tone: "text-emerald-600 bg-emerald-500/10" },
  { icon: Zap, titleKey: "landing.trust3Title", descKey: "landing.trust3Desc", tone: "text-amber-600 bg-amber-500/10" },
  { icon: MonitorSmartphone, titleKey: "landing.trust4Title", descKey: "landing.trust4Desc", tone: "text-violet-600 bg-violet-500/10" },
  { icon: Headphones, titleKey: "landing.trust5Title", descKey: "landing.trust5Desc", tone: "text-rose-600 bg-rose-500/10" },
];

const MODULES: Item[] = [
  { icon: Users, titleKey: "landing.module1Title", descKey: "landing.module1Desc", tone: "text-blue-600 bg-blue-500/10" },
  { icon: GraduationCap, titleKey: "landing.module2Title", descKey: "landing.module2Desc", tone: "text-emerald-600 bg-emerald-500/10" },
  { icon: ClipboardList, titleKey: "landing.module3Title", descKey: "landing.module3Desc", tone: "text-violet-600 bg-violet-500/10" },
  { icon: CalendarCheck, titleKey: "landing.module4Title", descKey: "landing.module4Desc", tone: "text-cyan-600 bg-cyan-500/10" },
  { icon: Banknote, titleKey: "landing.module5Title", descKey: "landing.module5Desc", tone: "text-amber-600 bg-amber-500/10" },
  { icon: MessageCircle, titleKey: "landing.module6Title", descKey: "landing.module6Desc", tone: "text-teal-600 bg-teal-500/10" },
  { icon: TrendingUp, titleKey: "landing.module7Title", descKey: "landing.module7Desc", tone: "text-fuchsia-600 bg-fuchsia-500/10" },
  { icon: LayoutDashboard, titleKey: "landing.module8Title", descKey: "landing.module8Desc", tone: "text-rose-600 bg-rose-500/10" },
];

const ABOUT_POINTS: { titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { titleKey: "landing.aboutPoint1Title", descKey: "landing.aboutPoint1Desc" },
  { titleKey: "landing.aboutPoint2Title", descKey: "landing.aboutPoint2Desc" },
  { titleKey: "landing.aboutPoint3Title", descKey: "landing.aboutPoint3Desc" },
  { titleKey: "landing.aboutPoint4Title", descKey: "landing.aboutPoint4Desc" },
];

export function LandingPage({ rootDomain }: { rootDomain: string }) {
  const t = useT();

  const navLinks: { href: string; labelKey: TranslationKey }[] = [
    { href: "#home", labelKey: "landing.navHome" },
    { href: "#about", labelKey: "landing.navAbout" },
    { href: "#contact", labelKey: "landing.navContact" },
  ];

  return (
    <div className="scroll-smooth bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <a href="#home" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/ekulmis-mark.png"
              alt=""
              width={256}
              height={243}
              className="h-9 w-auto object-contain sm:h-10"
              priority
            />
            <span className="leading-none">
              <span className="block text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                <span className="text-blue-600">e</span>Kulmis
              </span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:block">
                {t("landing.heroBadge")}
              </span>
            </span>
          </a>
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:px-3"
              >
                {t(l.labelKey)}
              </a>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#0b1f47] text-white"
      >
        {/* colour washes */}
        <div className="pointer-events-none absolute -start-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -end-32 top-10 h-[26rem] w-[26rem] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pt-16 text-center sm:px-8 sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-100 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {t("landing.heroBadge")}
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-blue-100/90 sm:text-lg">
            {t("landing.heroSubtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#contact"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0b1f47] shadow-lg shadow-blue-900/30 transition-transform hover:scale-[1.03]"
            >
              {t("landing.heroCta")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </a>
            <a
              href="#features"
              className="inline-flex h-12 items-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {t("landing.heroCtaSecondary")}
            </a>
          </div>

          {/* Dashboard preview, overlapping the section below */}
          <div className="mx-auto mt-14 max-w-5xl sm:mt-16">
            <div className="rounded-t-2xl border border-white/15 bg-white/10 p-1.5 shadow-2xl shadow-blue-950/50 backdrop-blur sm:rounded-t-3xl sm:p-2">
              <Image
                src="/ekulmis-dashboard-preview.png"
                alt="eKulmis dashboard"
                width={1400}
                height={748}
                className="w-full rounded-t-xl sm:rounded-t-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
          {TRUST.map((item) => (
            <div key={item.titleKey} className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t(item.titleKey)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t(item.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Schools we serve */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {t("landing.schoolsMarqueeTitle")}
            </h2>
            <p className="mt-3 text-slate-600">{t("landing.schoolsMarqueeSubtitle")}</p>
          </div>
          <div className="mt-10">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {t("landing.featuresTitle")}
            </h2>
            <p className="mt-3 text-slate-600">{t("landing.featuresSubtitle")}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <div
                key={m.titleKey}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.tone}`}>
                  <m.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{t(m.titleKey)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(m.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              {t("landing.navAbout")}
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              {t("landing.aboutTitle")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              {t("landing.aboutBody")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ABOUT_POINTS.map((p, i) => (
              <div key={p.titleKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{t(p.titleKey)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(p.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registered school note */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-8">
          <h2 className="text-lg font-bold text-slate-900">{t("landing.schoolSectionTitle")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("landing.schoolSectionBody")}{" "}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-800">
              yourschool.{rootDomain}
            </span>
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-white pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-[#0b1f47] px-6 py-12 text-center text-white shadow-xl sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -start-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-2xl" />

            <div className="relative">
              <h2 className="text-2xl font-bold sm:text-3xl">{t("landing.contactTitle")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-blue-100/90 sm:text-base">
                {t("landing.contactSubtitle")}
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-start shadow-lg transition-transform hover:scale-[1.03]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-500">{t("landing.whatsappUs")}</span>
                    <span className="block text-sm font-bold text-slate-900">{WHATSAPP_DISPLAY}</span>
                  </span>
                </a>

                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-6 py-4 text-start backdrop-blur transition-colors hover:bg-white/20"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                    <Mail className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-blue-100/80">{t("landing.emailUs")}</span>
                    <span className="block truncate text-sm font-bold text-white">{CONTACT_EMAIL}</span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/ekulmis-mark.png"
              alt=""
              width={256}
              height={243}
              className="h-8 w-auto object-contain"
            />
            <span className="text-base font-bold tracking-tight text-slate-900">
              <span className="text-blue-600">e</span>Kulmis
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-700">{t("landing.developedBy")}</p>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} eKulmis. {t("landing.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
