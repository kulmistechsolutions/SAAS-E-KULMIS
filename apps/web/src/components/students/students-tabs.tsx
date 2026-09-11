"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, UsersRound } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The two halves of the Students section.
 *
 * Documents used to sit in the sidebar as its own entry, which read as a
 * separate module and put a second "Students"-shaped thing in a list that is
 * already long. It is the same records seen a different way, so it belongs
 * inside the section rather than beside it — and a tab bar says that where a
 * sidebar entry says the opposite.
 *
 * Rendered by both pages so the bar does not appear and disappear as a desk
 * moves between them.
 */
const TABS: {
  href: string;
  label: TranslationKey;
  icon: typeof UsersRound;
  /** The list lives at the section root, so it must not match its own children. */
  exact?: boolean;
}[] = [
  { href: "/students", label: "students.students", icon: UsersRound, exact: true },
  { href: "/students/documents", label: "nav.studentDocuments", icon: FileText },
];

export function StudentsTabs() {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
