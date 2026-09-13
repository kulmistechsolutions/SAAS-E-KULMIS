"use client";

import { useT } from "@/lib/i18n/provider";
import { History } from "lucide-react";
import { getSettings, useSettingsState } from "@/lib/settings/store";
import { dateTime } from "@/lib/users/format";

/**
 * Settings Activity — who changed what in this school's settings.
 *
 * This page used to print the platform's own metadata to every school: the
 * software version, the build number, the database engine, the installation
 * date and the server clock. None of it is the school's, none of it is
 * actionable by a head teacher, and naming the database engine and version to
 * every tenant hands an attacker the first two facts they would otherwise
 * have to guess. That belongs to the platform owner's console, not here.
 *
 * What stays is the part that was always the school's own: the record of its
 * own settings changes.
 */
export default function SettingsActivityPage() {
  const t = useT();
  useSettingsState();
  const s = getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <History className="h-6 w-6 text-primary" />
          Settings Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change made to this school&apos;s settings, newest first.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">{t("settingsSystem.settingsAuditLog")}</h2>
          <span className="text-xs text-muted-foreground">
            {s.audit.length} {s.audit.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {s.audit.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No settings have been changed yet.
          </p>
        ) : (
          <ul className="divide-y">
            {s.audit.slice(0, 100).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {a.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.user}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateTime(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
