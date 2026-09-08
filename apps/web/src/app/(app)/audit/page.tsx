"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, Search } from "lucide-react";
import { csvRow } from "@ekulmis/shared";
import { useT } from "@/lib/i18n/provider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Can } from "@/components/auth/can";

/**
 * Who changed what.
 *
 * The server has recorded this since the audit module was built, and no screen
 * has ever shown it — so a school could be told its finances were auditable
 * while having no way to audit them. The questions it exists to answer are
 * specific ("who changed this family's fee in August", "who reversed that
 * receipt"), which is why it opens filtered rather than as a feed: paging
 * fifty at a time through every login in the school is not an answer.
 *
 * Read-only by construction. There is no edit here and there should never be
 * one: a log a school can amend is not evidence of anything.
 */

interface Entry {
  id: string;
  username: string | null;
  role: string | null;
  module: string;
  action: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Facets {
  modules: { name: string; count: number }[];
  actions: { name: string; count: number }[];
}

const PAGE = 50;

/** "FEE_COLLECTED" reads as "Fee collected" without needing a translation each. */
function humanise(action: string): string {
  const s = action.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The money facts, if this entry carries any, as "amount 40 · month 9". */
function detailsOf(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(" · ");
}

export default function AuditPage() {
  const t = useT();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [facets, setFacets] = useState<Facets>({ modules: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Typing in the search box must not requery on every keystroke; the query
  // below runs on what was actually asked for.
  const [applied, setApplied] = useState({ q: "" });

  useEffect(() => {
    let alive = true;
    api<Facets>("/audit/facets")
      .then((f) => alive && setFacets(f))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const p = new URLSearchParams({ take: String(PAGE), skip: String(skip) });
    if (module) p.set("module", module);
    if (action) p.set("action", action);
    if (applied.q) p.set("q", applied.q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
      const d = await api<{ items: Entry[]; total: number }>(`/audit?${p}`);
      setEntries(d.items);
      setTotal(d.total);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [skip, module, action, applied, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any change of filter starts again at the first page: staying on page 4 of
  // a list that no longer has one is how a filtered screen looks empty.
  const setFilter = (fn: () => void) => {
    fn();
    setSkip(0);
  };

  const reset = () => {
    setModule("");
    setAction("");
    setQ("");
    setApplied({ q: "" });
    setFrom("");
    setTo("");
    setSkip(0);
  };

  const filterNote = useMemo(
    () =>
      [
        module || t("audit.allModules"),
        action ? humanise(action) : t("audit.allActions"),
        from || to ? `${from || "…"} → ${to || "…"}` : "",
        applied.q,
      ]
        .filter(Boolean)
        .join(" · "),
    [module, action, from, to, applied.q, t],
  );

  /**
   * Exports what is on screen, not everything: a filtered export that quietly
   * widened to the whole log would be the opposite of the answer that was
   * asked for, and the filter line rides in the file so a renamed copy still
   * says what it covers.
   */
  function exportCsv() {
    const lines = [
      csvRow([`${t("audit.title")} — ${filterNote}`]),
      "",
      csvRow(["When", "User", "Role", "Module", "Action", "Details", "IP"]),
      ...entries.map((e) =>
        csvRow([
          new Date(e.createdAt).toISOString().replace("T", " ").slice(0, 19),
          e.username ?? "",
          e.role ?? "",
          e.module,
          humanise(e.action),
          detailsOf(e.metadata),
          e.ip ?? "",
        ]),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("audit.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("audit.intro")}</p>
        </div>
        <Can perform="audit.export">
          <Button variant="outline" onClick={exportCsv} disabled={entries.length === 0}>
            <Download className="me-2 h-4 w-4" />
            {t("audit.exportCsv")}
          </Button>
        </Can>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b bg-secondary/20 px-5 py-4">
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("audit.module")}
            </label>
            <Select
              value={module}
              onChange={(e) => setFilter(() => setModule(e.target.value))}
            >
              <option value="">{t("audit.allModules")}</option>
              {facets.modules.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count})
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[190px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("audit.action")}
            </label>
            <Select
              value={action}
              onChange={(e) => setFilter(() => setAction(e.target.value))}
            >
              <option value="">{t("audit.allActions")}</option>
              {facets.actions.map((a) => (
                <option key={a.name} value={a.name}>
                  {humanise(a.name)} ({a.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("audit.from")}
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFilter(() => setFrom(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("audit.to")}
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setFilter(() => setTo(e.target.value))}
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("audit.search")}
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilter(() => setApplied({ q }));
              }}
              placeholder={t("audit.searchPlaceholder")}
            />
          </div>
          <Button onClick={() => setFilter(() => setApplied({ q }))}>
            <Search className="me-2 h-4 w-4" />
            {t("audit.searchButton")}
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t("audit.reset")}
          </Button>
        </div>

        {failed ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("audit.couldNotLoad")}
          </p>
        ) : loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("audit.nothingMatches")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("audit.when")}</th>
                  <th className="p-3 text-start">{t("audit.who")}</th>
                  <th className="p-3 text-start">{t("audit.action")}</th>
                  <th className="p-3 text-start">{t("audit.details")}</th>
                  <th className="p-3 text-start">{t("audit.ip")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{e.username ?? "—"}</span>
                      {e.role && (
                        <span className="block text-xs text-muted-foreground">
                          {e.role.replace(/_/g, " ").toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{humanise(e.action)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.module}
                      </span>
                    </td>
                    <td className="max-w-md p-3 text-xs text-muted-foreground">
                      {detailsOf(e.metadata) || "—"}
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                      {e.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm">
          <span className="text-muted-foreground">
            {total === 0
              ? "—"
              : `${skip + 1}–${Math.min(skip + PAGE, total)} / ${total}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE))}
            >
              {t("audit.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={skip + PAGE >= total}
              onClick={() => setSkip(skip + PAGE)}
            >
              {t("audit.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
