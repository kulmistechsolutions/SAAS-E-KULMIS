"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { fetchDataHealth, type DataHealth, type HealthCheck } from "@/lib/platform/api";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-white/10 bg-white/[0.03] p-5";

const SEVERITY: Record<
  HealthCheck["severity"],
  { label: string; cls: string; icon: typeof AlertTriangle }
> = {
  critical: { label: "Critical", cls: "text-rose-300 bg-rose-500/15", icon: ShieldAlert },
  warning: { label: "Warning", cls: "text-amber-300 bg-amber-500/15", icon: AlertTriangle },
  info: { label: "Review", cls: "text-sky-300 bg-sky-500/15", icon: Info },
};

function CheckRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = useState(check.severity === "critical" && check.failed);
  const sev = SEVERITY[check.severity];

  return (
    <div
      className={cn(
        "rounded-xl border bg-black/20",
        check.failed ? "border-white/15" : "border-white/[0.06]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-start"
      >
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            check.failed ? sev.cls : "bg-emerald-500/15 text-emerald-300",
          )}
        >
          {check.failed ? <sev.icon className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-medium",
                check.failed ? "text-white" : "text-slate-400",
              )}
            >
              {check.title}
            </span>
            {check.failed && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", sev.cls)}>
                {sev.label}
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            {check.meaning}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "tabular-nums font-bold",
              check.failed ? "text-rose-300" : "text-emerald-400",
            )}
          >
            {check.failed ? check.count : "0"}
          </span>
          {check.failed &&
            (open ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ))}
        </span>
      </button>

      {open && check.failed && (
        <div className="border-t border-white/10 px-4 py-3">
          <table className="w-full text-sm">
            <tbody>
              {check.schools.map((s) => (
                <tr key={s.school} className="border-b border-white/5 last:border-0">
                  <td className="py-1.5 pe-3 text-slate-300">{s.school}</td>
                  <td className="py-1.5 pe-3 text-xs text-slate-500">{s.detail ?? ""}</td>
                  <td className="py-1.5 text-end font-semibold tabular-nums text-slate-200">
                    {s.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DataHealthPage() {
  const [data, setData] = useState<DataHealth | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchDataHealth());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clean = data && data.failing === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Health</h1>
          <p className="mt-1 text-sm text-slate-400">
            Faults that never raise an error — a figure counted twice and updated
            once, a row left behind, a student billed for a month they were
            excused. Every check passes when the answer is nothing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50"
          aria-label="Re-run checks"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {failed && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not run the checks.
        </div>
      )}

      {data && (
        <div
          className={cn(
            CARD,
            "flex items-center gap-4",
            clean ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-amber-500/25",
          )}
        >
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              clean ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300",
            )}
          >
            {clean ? <Check className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </span>
          <div>
            <p className="font-semibold text-white">
              {clean
                ? "Everything checks out."
                : `${data.failing} of ${data.checks.length} checks need a look.`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Last run {new Date(data.checkedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data?.checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
        {!data && !failed && (
          <div className={cn(CARD, "text-sm text-slate-400")}>Running checks…</div>
        )}
      </div>
    </div>
  );
}
