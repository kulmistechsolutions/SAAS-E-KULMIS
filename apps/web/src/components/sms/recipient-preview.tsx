"use client";

import type { SmsAudienceRecipient } from "@/lib/sms/api";

interface Props {
  recipients: SmsAudienceRecipient[];
  selected: Set<string>;
  onToggle: (recordId: string) => void;
  onToggleAll: (checked: boolean) => void;
  loading?: boolean;
}

export function RecipientPreview({
  recipients,
  selected,
  onToggle,
  onToggleAll,
  loading,
}: Props) {
  const allSelected =
    recipients.length > 0 && recipients.every((r) => selected.has(r.recordId));

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b bg-secondary/60 px-4 py-2 text-xs">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onToggleAll(e.target.checked)}
            disabled={recipients.length === 0}
            className="h-4 w-4 rounded border-input"
          />
          Dooro dhammaan
        </label>
        <span className="text-muted-foreground">
          {selected.size} / {recipients.length} qof ayaa fariinta heli doona
        </span>
      </div>
      <div className="max-h-[360px] overflow-auto scrollbar-slim">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Soo raridda liiska…
          </p>
        ) : recipients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Cid uma helin xulashadan.
          </p>
        ) : (
          <ul className="divide-y">
            {recipients.map((r) => (
              <li
                key={r.recordId}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/40"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.recordId)}
                  onChange={() => onToggle(r.recordId)}
                  className="h-4 w-4 shrink-0 rounded border-input"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.name ?? "—"}
                    {r.variables.studentName && r.variables.studentName !== r.name && (
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
