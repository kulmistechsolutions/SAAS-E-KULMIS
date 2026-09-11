"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The tab bar that holds one module's pages together.
 *
 * A second view of the same records used to get its own sidebar entry, which
 * read as a separate module and put another Students- or Teachers-shaped thing
 * in a list that is already long. A tab bar says "the same section, seen
 * differently"; a sidebar entry says the opposite.
 *
 * Rendered by every page in the section, so the bar does not appear and
 * disappear as a desk moves between them.
 */

export interface SectionTab {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  /**
   * The section root must match its own path exactly, or it stays highlighted
   * while you are standing on one of its children.
   */
  exact?: boolean;
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b">
      {tabs.map((tab) => {
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
