"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings2,
  Shield,
  Sparkles,
  Layers,
  ExternalLink,
} from "lucide-react";
import { usePlatformAuth } from "@/lib/platform/auth";
import { countUnread, fetchPlatformEvents, getLastSeenAt } from "@/lib/platform/notifications";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/platform/notifications", label: "Notifications", icon: Bell },
  { href: "/platform/schools", label: "Schools", icon: Building2 },
  { href: "/platform/subscriptions", label: "Subscriptions", icon: Layers },
  { href: "/platform/sms/settings", label: "SMS Settings", icon: Settings2 },
  { href: "/platform/sms/payments", label: "Waafi Payments", icon: CreditCard },
  { href: "/platform/sms", label: "SMS Packages", icon: MessageSquare, exact: true },
  { href: "/platform/ai", label: "AI Grading", icon: Sparkles },
  { href: "/platform/error-logs", label: "Error Logs", icon: AlertTriangle },
];

const UNREAD_POLL_MS = 60_000;

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout, isPreview } = usePlatformAuth();
  const [unread, setUnread] = useState(0);

  async function refreshUnread() {
    try {
      const events = await fetchPlatformEvents();
      setUnread(countUnread(events, getLastSeenAt()));
    } catch {
      /* keep previous count */
    }
  }

  useEffect(() => {
    void refreshUnread();
    const id = setInterval(() => void refreshUnread(), UNREAD_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pathname === "/platform/notifications") setUnread(0);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/platform/login");
  }

  return (
    <div className="flex min-h-screen bg-[#0b1120] text-slate-200">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-white/10 bg-[#0f172a] lg:flex">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-white">{t("platformPlatformShell.ekulmis")}</p>
              <p className="text-[11px] text-violet-300">{t("platformPlatformShell.platformSuperAdmin")}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-violet-600/90 font-medium text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.href === "/platform/notifications" && unread > 0 && (
                  <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            {t("platformPlatformShell.schoolErpLogin")}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            {t("platformPlatformShell.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b1120]/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="lg:hidden">
            <p className="text-sm font-bold text-white">{t("platformPlatformShell.platformSuperAdmin")}</p>
          </div>
          <div className="ms-auto text-end text-sm">
            <p className="font-medium text-white">{admin?.name ?? admin?.username}</p>
            <p className="text-xs text-slate-400">
              {isPreview ? "Preview mode" : "Platform administrator"}
            </p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PlatformGuard({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { admin, loading, isPreview } = usePlatformAuth();

  useEffect(() => {
    if (!loading && !admin) router.replace("/platform/login");
  }, [admin, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-slate-400">
        {t("platformPlatformShell.loadingPlatform")}
      </div>
    );
  }

  if (!admin) return null;

  return (
    <>
      {isPreview ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
          {t("platformPlatformShell.offlinePreviewApiTokenMissingLog")}
        </div>
      ) : null}
      <PlatformShell>{children}</PlatformShell>
    </>
  );
}
