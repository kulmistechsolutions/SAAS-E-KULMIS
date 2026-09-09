"use client";

import { useEffect, useState } from "react";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { Select } from "@/components/ui/select";
import {
  DOC_TEMPLATES,
  getStoredTemplate,
  setStoredTemplate,
  type DocTemplate,
} from "@/lib/print/template";

/**
 * Which design the next document prints in.
 *
 * Sits beside the paper picker for the same reason it does: the choice belongs
 * to the desk doing the printing, and it is remembered for this browser so a
 * school picks it once. It selects a layout and nothing else — both designs
 * are handed the identical payment, so this can never change what a document
 * says, only how it looks.
 *
 * Read on mount rather than at render, so the server and the first client
 * paint agree and React does not throw a hydration mismatch.
 */
export function TemplatePicker({
  value,
  onChange,
  className,
}: {
  value?: DocTemplate;
  onChange: (t: DocTemplate) => void;
  className?: string;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!value) onChange(getStoredTemplate());
    // Only on mount: this seeds the parent from storage, it does not follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = value ?? "PREMIUM";

  return (
    <label className={className}>
      <span className="mb-1 block text-xs text-muted-foreground">
        {t("printTemplate.label")}
      </span>
      <Select
        value={current}
        disabled={!mounted}
        onChange={(e) => {
          const next = e.target.value as DocTemplate;
          setStoredTemplate(next);
          onChange(next);
        }}
      >
        {DOC_TEMPLATES.map((d) => (
          <option key={d.id} value={d.id}>
            {t(d.labelKey as TranslationKey)}
          </option>
        ))}
      </Select>
    </label>
  );
}
