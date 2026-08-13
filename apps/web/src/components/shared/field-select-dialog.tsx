"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export interface FieldOption {
  key: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FieldOption[];
  /** Field keys checked when the dialog opens. */
  defaultSelected: string[];
  confirmLabel: string;
  onConfirm: (selectedKeys: string[]) => void;
}

/**
 * Lets the admin pick which columns go into a print/export before it runs.
 * Selection order always follows `fields` (the canonical column order), not
 * click order, so output stays predictable regardless of which boxes were
 * toggled last.
 */
export function FieldSelectDialog({
  open,
  onClose,
  title,
  description,
  fields,
  defaultSelected,
  confirmLabel,
  onConfirm,
}: Props) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  useEffect(() => {
    if (open) setSelected(new Set(defaultSelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function confirm() {
    const ordered = fields.map((f) => f.key).filter((k) => selected.has(k));
    onConfirm(ordered);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("uiFieldSelectDialog.cancel")}
          </Button>
          <Button onClick={confirm} disabled={selected.size === 0}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {t("uiFieldSelectDialog.fieldsSelected").replace("{n}", String(selected.size))}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setSelected(new Set(fields.map((f) => f.key)))}
          >
            {t("uiFieldSelectDialog.selectAll")}
          </button>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setSelected(new Set())}
          >
            {t("uiFieldSelectDialog.selectNone")}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {fields.map((f) => (
          <label
            key={f.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary"
          >
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-primary"
              checked={selected.has(f.key)}
              onChange={() => toggle(f.key)}
            />
            <span className="truncate">{f.label}</span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
