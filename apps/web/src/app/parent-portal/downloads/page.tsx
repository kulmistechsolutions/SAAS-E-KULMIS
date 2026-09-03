"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/components/parent-portal/portal-context";
import {
  childExamResults,
  childFeeSummary,
  loadChildFeeSummary,
  logPortalAudit,
  studentPayments,
} from "@/lib/parent-portal/store";
import {
  printAttendanceReport,
  printFeeReceipt,
  printFeeStatement,
  printResultSlip,
} from "@/lib/parent-portal/print";
import { studentPublishedResults } from "@/lib/examinations/store";

export default function ParentDownloadsPage() {
  const t = useT();
  const { parent, selectedChild } = usePortal();

  // Both of these come from the API and were previously read from stubs that
  // returned nothing, so the fee statement was permanently empty and the
  // receipt button permanently disabled — for families who had paid.
  const [fees, setFees] = useState(() =>
    selectedChild ? childFeeSummary(selectedChild) : null,
  );
  const [latestPayment, setLatestPayment] = useState<
    Awaited<ReturnType<typeof studentPayments>>[number] | undefined
  >(undefined);

  useEffect(() => {
    let live = true;
    if (!selectedChild) return;
    void loadChildFeeSummary(selectedChild).then((f) => {
      if (live) setFees(f);
    });
    void studentPayments(selectedChild.id).then((rows) => {
      if (live) setLatestPayment(rows[0]);
    });
    return () => {
      live = false;
    };
  }, [selectedChild]);

  if (!selectedChild || !fees) {
    return <p className="text-muted-foreground">{t("parentPortalDownloads.selectAChildToAccessDownloads")}</p>;
  }

  const results = childExamResults(selectedChild.id);
  const latestResult = studentPublishedResults(selectedChild.id).slice(-1)[0];

  const downloads = [
    {
      title: t("parentPortalDownloads.studentResultSlip"),
      desc: "Latest published examination result",
      enabled: !results.blocked && !!latestResult,
      action: () => latestResult && printResultSlip(selectedChild, latestResult),
    },
    {
      title: t("parentPortalDownloads.attendanceReport"),
      desc: "Daily attendance summary (PDF)",
      enabled: true,
      action: () => printAttendanceReport(selectedChild),
    },
    {
      title: t("parentPortalDownloads.feeReceipt"),
      desc: "Most recent payment receipt",
      enabled: !!latestPayment,
      action: () => {
        if (!latestPayment) return;
        logPortalAudit(parent.id, "RECEIPT_DOWNLOADED", selectedChild.id, latestPayment.receiptNo);
        printFeeReceipt(latestPayment, selectedChild.fullName);
      },
    },
    {
      title: t("parentPortalDownloads.annualFeeStatement"),
      desc: "Full year fee ledger",
      enabled: fees.ledger.length > 0,
      action: () => printFeeStatement(selectedChild, fees.ledger),
    },
    {
      title: t("parentPortalDownloads.academicTranscript"),
      desc: "Available when promotion records exist",
      enabled: false,
      action: () => {},
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("parentPortalDownloads.downloadCenter")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("parentPortalDownloads.pdfDocumentsFor")} {selectedChild.fullName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {downloads.map((d) => (
          <div
            key={d.title}
            className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{d.title}</h2>
              <p className="text-sm text-muted-foreground">{d.desc}</p>
              <Button
                className="mt-3"
                disabled={!d.enabled}
                onClick={d.action}
              >
                <Download className="me-2 h-4 w-4" />
                {t("parentPortalDownloads.downloadPdf")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
