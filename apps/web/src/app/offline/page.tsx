
import { useT } from "@/lib/i18n/provider";
export const metadata = { title: "Offline" };

export default function OfflinePage() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 20h.01" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </div>
      <h1 className="text-xl font-bold">{t("offline.youAposReOffline")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("offline.thisPageNeedsAConnectionReconnect")}
      </p>
    </div>
  );
}
