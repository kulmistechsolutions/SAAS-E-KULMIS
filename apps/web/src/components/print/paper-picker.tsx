"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Select } from "@/components/ui/select";
import {
  getStoredPaper,
  PAPER_ORDER,
  PAPER_SIZES,
  setStoredPaper,
  type PaperSize,
} from "@/lib/print/paper";

/**
 * Which paper the next print goes onto.
 *
 * The choice is remembered for this browser: a desk prints on the same
 * printer every day and should not have to pick A5 forty times a morning.
 * Read on mount rather than at render, so the server and the first client
 * paint agree and React does not throw a hydration mismatch.
 */
export function PaperPicker({
  value,
  onChange,
  className,
}: {
  value?: PaperSize;
  onChange: (size: PaperSize) => void;
  className?: string;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!value) onChange(getStoredPaper());
    // Only on mount: this seeds the parent from storage, it does not follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = value ?? "A4";

  return (
    <label className={className}>
      <span className="mb-1 block text-xs text-muted-foreground">
        {t("printPaper.label")}
      </span>
      <Select
        value={current}
        disabled={!mounted}
        onChange={(e) => {
          const next = e.target.value as PaperSize;
          setStoredPaper(next);
          onChange(next);
        }}
      >
        {PAPER_ORDER.map((id) => (
          <option key={id} value={id}>
            {t(PAPER_SIZES[id].labelKey as never)}
          </option>
        ))}
      </Select>
    </label>
  );
}
