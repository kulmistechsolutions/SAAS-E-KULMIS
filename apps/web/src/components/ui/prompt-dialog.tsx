"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";

interface Props {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** A single-field text form in a modal, replacing window.prompt(). */
export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue = "",
  confirmLabel,
  onSubmit,
  onClose,
}: Props) {
  const t = useT();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!value.trim()} onClick={submit}>
            {confirmLabel ?? t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium">{label}</label>}
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
    </Dialog>
  );
}
