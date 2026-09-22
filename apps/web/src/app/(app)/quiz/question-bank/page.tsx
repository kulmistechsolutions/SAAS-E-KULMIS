"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BankBrowser } from "@/components/quiz/bank-browser";
import { BankItemDialog } from "@/components/quiz/bank-item-dialog";
import {
  apiBankArchive,
  apiBankOptions,
  type BankItem,
  type BankOptions,
} from "@/lib/quiz/bank-api";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";

/**
 * The school's question bank.
 *
 * Replaces a page that kept its questions in the browser, where no quiz
 * could reach them and they vanished with the browser's storage. These live
 * on the server, in the school's own tenant, and go into a quiz from the
 * quiz builder's "Add from bank".
 */
export default function QuestionBankPage() {
  const t = useT();
  const [options, setOptions] = useState<BankOptions | null>(null);
  const [editing, setEditing] = useState<BankItem | null>(null);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiBankOptions()
      .then(setOptions)
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load the filters", "error"));
  }, [reloadKey]);

  async function archive(item: BankItem) {
    if (!window.confirm(t("questionBank.confirmRemove"))) return;
    try {
      await apiBankArchive(item.id);
      toast(t("questionBank.removed"), "success");
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove it", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("questionBank.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("questionBank.subtitle")}</p>
        </div>
        <Button
          className="h-9"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t("questionBank.new")}
        </Button>
      </div>

      <BankBrowser
        options={options}
        mode="manage"
        reloadKey={reloadKey}
        onEdit={(it) => {
          setEditing(it);
          setOpen(true);
        }}
        onArchive={(it) => void archive(it)}
      />

      <BankItemDialog
        open={open}
        item={editing}
        options={options}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
