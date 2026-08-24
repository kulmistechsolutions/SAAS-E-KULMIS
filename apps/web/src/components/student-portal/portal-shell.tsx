"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Wallet,
} from "lucide-react";
import { apiFetchStudentPortalPhotoBlob, studentPortalLogout } from "@/lib/student-portal/api";
import type { StudentPortalMe } from "@/lib/student-portal/api";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/student-portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/student-portal/results", label: "Results", icon: FileText },
  { href: "/student-portal/quizzes", label: "Quizzes", icon: ClipboardList },
  { href: "/student-portal/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/student-portal/fees", label: "Fees", icon: Wallet },
  { href: "/student-portal/announcements", label: "Announcements", icon: Megaphone },
];

export function StudentPortalShell({
  me,
  children,
}: {
  me: StudentPortalMe;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    void apiFetchStudentPortalPhotoBlob()
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => setPhotoUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  function signOut() {
    studentPortalLogout();
    router.replace("/student-portal/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-10 border-b bg-card/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {photoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="h-11 w-11 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl shadow-sm ring-2 ring-background transition hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-primary"
                aria-label={`View photo of ${me.fullName}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt={me.fullName} className="h-full w-full object-cover" />
              </button>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-base font-bold text-white shadow-sm">
                {me.fullName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{me.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {me.code} · {me.class.name}
                {me.section ? ` · ${me.section.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Students read this portal in the same three languages everyone
                else does — the parent and teacher shells already offer it. */}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={signOut}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>

      {photoUrl ? (
        <ImageLightbox
          open={lightboxOpen}
          src={photoUrl}
          alt={me.fullName}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
