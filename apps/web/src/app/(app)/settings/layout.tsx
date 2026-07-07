"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SettingsNav } from "@/components/settings/settings-nav";
import { usePermission } from "@/lib/users/use-permission";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const canView = usePermission("settings", "view");
  const canUpdate = usePermission("settings", "update");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !canView) router.replace("/dashboard");
  }, [mounted, canView, router]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading settings…
      </div>
    );
  }

  if (!canView) return null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="rounded-xl border bg-card p-3 lg:sticky lg:top-20">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration
          </p>
          <SettingsNav />
        </div>
        {!canUpdate && (
          <p className="mt-2 text-xs text-amber-600">
            Read-only access. Contact an administrator to change settings.
          </p>
        )}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
