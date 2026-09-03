"use client";

import { useState } from "react";
import { MessageSquare, Phone, Send } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiSendSms } from "@/lib/sms/api";
import { money } from "@/lib/fees/format";
import type { StudentFeeState } from "@/lib/fees/types";

interface ParentContactActionsProps {
  parentPhone: string;
  parentName: string;
  /** Who the message is about, e.g. "Amina Hassan (Grade 5)" or "3 children". */
  subject: string;
  outstandingBalance: number;
  status?: StudentFeeState;
}

function defaultMessage(props: ParentContactActionsProps): {
  category: "PAYMENT_CONFIRMATION" | "FEE_REMINDER";
  body: string;
} {
  const { parentName, subject, outstandingBalance, status } = props;
  const isSettled =
    status === "PAID" || status === "ADVANCE" || status === "ADVANCE_MULTI" || outstandingBalance <= 0;
  if (isSettled) {
    return {
      category: "PAYMENT_CONFIRMATION",
      body: `Salaan ${parentName}, waxaan xaqiijinaynaa in lacagta dugsiyeed ee ${subject} la bixiyay oo dhan. Mahadsanid.\n{{Magaca Dugsiga}}`,
    };
  }
  if (status === "PARTIAL") {
    return {
      category: "FEE_REMINDER",
      body: `Salaan ${parentName}, ${subject} wuxuu wali leeyahay lacag dhiman oo dhan ${money(outstandingBalance)}. Fadlan dhammaystir lacagta.\n{{Magaca Dugsiga}}`,
    };
  }
  return {
    category: "FEE_REMINDER",
    body: `Salaan ${parentName}, waxaan ku xasuusinaynaa in ${subject} uu leeyahay lacag dugsiyeed oo dhan ${money(outstandingBalance)}. Fadlan bixi lacagta si looga fogaado dib u dhac.\n{{Magaca Dugsiga}}`,
  };
}

/** Quick call/SMS actions for the parent of a student, shown right in the Collect Fees flow. */
export function ParentContactActions(props: ParentContactActionsProps) {
  const t = useT();
  const { parentPhone, parentName } = props;
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"PAYMENT_CONFIRMATION" | "FEE_REMINDER">("FEE_REMINDER");
  const [sending, setSending] = useState(false);

  const hasPhone = !!parentPhone && parentPhone !== "—";

  function openCompose() {
    const draft = defaultMessage(props);
    setCategory(draft.category);
    setBody(draft.body);
    setOpen(true);
  }

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await apiSendSms({
        category,
        body: body.trim(),
        recipients: [{ phone: parentPhone, name: parentName, type: "PARENT" }],
      });
      toast(t("feesParentContact.smsSent"), "success");
      setOpen(false);
    } catch {
      toast(t("feesParentContact.smsFailed"), "error");
    } finally {
      setSending(false);
    }
  }

  if (!hasPhone) {
    return <span className="text-xs text-muted-foreground">{t("feesParentContact.noPhoneOnFile")}</span>;
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <a
          href={`tel:${parentPhone}`}
          title={t("feesParentContact.call")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          title={t("feesParentContact.sendSms")}
          onClick={openCompose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("feesParentContact.composeSmsTo", { name: parentName })}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={send} disabled={sending || !body.trim()}>
              <Send className="me-1.5 h-3.5 w-3.5" />
              {sending ? t("feesParentContact.sending") : t("feesParentContact.send")}
            </Button>
          </>
        }
      >
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("feesParentContact.message")}
        </label>
        <textarea
          className="min-h-[140px] w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Dialog>
    </>
  );
}
