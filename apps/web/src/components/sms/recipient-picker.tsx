"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SmsAudienceRecipient } from "@/lib/sms/api";

type FilterMode = "all" | "selected" | "unselected";

interface Props {
  open: boolean;
  onClose: () => void;
  recipients: SmsAudienceRecipient[];
  selected: Set<string>;
  onToggle: (recordId: string) => void;
  onToggleAll: (checked: boolean) => void;
  loading?: boolean;
}

export function RecipientPickerDialog({
  open,
  onClose,
  recipients,
  selected,
  onToggle,
  onToggleAll,
  loading,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      if (filter === "selected" && !selected.has(r.recordId)) return false;
      if (filter === "unselected" && selected.has(r.recordId)) return false;
      if (!q) return true;
      const haystack = [
        r.name ?? "",
        r.phone,
        r.variables.studentName ?? "",
        r.variables.className ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recipients, selected, query, filter]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.recordId));

  function toggleAllVisible(checked: boolean) {
    // When a search/filter narrows the list, only affect the visible rows.
    if (!query.trim() && filter === "all") {
      onToggleAll(checked);
      return;
    }
    for (const r of filtered) {
      const isOn = selected.has(r.recordId);
      if (checked && !isOn) onToggle(r.recordId);
      if (!checked && isOn) onToggle(r.recordId);
    }
  }

  const filters: { key: FilterMode; label: string }[] = [
    { key: "all", label: "All" },
    { key: "selected", label: "Selected" },
    { key: "unselected", label: "Excluded" },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose recipients"
      description={`${selected.size} of ${recipients.length} people will receive this message`}
      className="sm:max-w-2xl"
      footer={
        <Button onClick={onClose}>Done ({selected.size})</Button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 gap-1 rounded-lg border bg-secondary/50 p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-secondary/40 px-3 py-2 text-xs">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleAllVisible(e.target.checked)}
              disabled={filtered.length === 0}
              className="h-4 w-4 rounded border-input"
            />
            Select all{query.trim() || filter !== "all" ? " shown" : ""}
          </label>
          <span className="text-muted-foreground">
            {filtered.length} shown
          </span>
        </div>

        <div className="max-h-[46vh] overflow-auto rounded-lg border">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Loading recipients…
            </p>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
              {recipients.length === 0
                ? "No people matched this audience."
                : "No results for this search."}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((r) => {
                const on = selected.has(r.recordId);
                return (
                  <li key={r.recordId}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary/50 ${
                        on ? "" : "opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(r.recordId)}
                        className="h-4 w-4 shrink-0 rounded border-input"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {r.name ?? "—"}
                          {r.variables.studentName &&
                            r.variables.studentName !== r.name && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                ({r.variables.studentName})
                              </span>
                            )}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {r.phone}
                          {r.variables.className ? ` · ${r.variables.className}` : ""}
                          {r.variables.section ? ` - ${r.variables.section}` : ""}
                        </p>
                      </div>
                      {r.variables.outstandingBalance && (
                        <span className="shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {r.variables.outstandingBalance}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
