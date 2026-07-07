"use client";

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/components/parent-portal/portal-context";
import {
  childExamResults,
  childFeeSummary,
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
  const { parent, selectedChild } = usePortal();

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to access downloads.</p>;
  }

  const fees = childFeeSummary(selectedChild);
  const results = childExamResults(selectedChild.id);
  const latestPayment = studentPayments(selectedChild.id)[0];
  const latestResult = studentPublishedResults(selectedChild.id).slice(-1)[0];

  const downloads = [
    {
      title: "Student Result Slip",
      desc: "Latest published examination result",
      enabled: !results.blocked && !!latestResult,
      action: () => latestResult && printResultSlip(selectedChild, latestResult),
    },
    {
      title: "Attendance Report",
      desc: "Daily attendance summary (PDF)",
      enabled: true,
      action: () => printAttendanceReport(selectedChild),
    },
    {
      title: "Fee Receipt",
      desc: "Most recent payment receipt",
      enabled: !!latestPayment,
      action: () => {
        if (!latestPayment) return;
        logPortalAudit(parent.id, "RECEIPT_DOWNLOADED", selectedChild.id, latestPayment.receiptNo);
        printFeeReceipt(latestPayment, selectedChild.fullName);
      },
    },
    {
      title: "Annual Fee Statement",
      desc: "Full year fee ledger",
      enabled: fees.ledger.length > 0,
      action: () => printFeeStatement(selectedChild, fees.ledger),
    },
    {
      title: "Academic Transcript",
      desc: "Available when promotion records exist",
      enabled: false,
      action: () => {},
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF documents for {selectedChild.fullName}
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
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
