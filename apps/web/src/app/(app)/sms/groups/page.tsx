"use client";

import { useT } from "@/lib/i18n/provider";
import { useHydrated } from "@/lib/use-hydrated";
import { ContactManager } from "@/components/sms/contact-manager";

/**
 * The school's own recipient groups.
 *
 * The manager itself already existed and works; what it lacked was an address.
 * It lived as a tab inside the send screen, so building a group meant starting
 * to compose a message you did not intend to send, and nothing could link to
 * it. The component is reused rather than rebuilt — a second copy of a working
 * editor is a second place for it to drift.
 */
export default function SmsGroupsPage() {
  const t = useT();
  const mounted = useHydrated();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("smsGroups.title")}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t("smsGroups.intro")}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        {mounted ? (
          // The manager reloads its own groups; there is nothing on this page
          // that needs telling when they change.
          <ContactManager onGroupsChanged={() => undefined} />
        ) : (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
