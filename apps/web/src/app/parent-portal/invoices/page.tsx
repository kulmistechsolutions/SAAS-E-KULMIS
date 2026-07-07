"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/components/parent-portal/portal-context";
import { childFeeSummary } from "@/lib/parent-portal/store";
import { printFeeStatement } from "@/lib/parent-portal/print";
import { money } from "@/lib/students/format";

export default function ParentInvoicesPage() {
  const { selectedChild } = usePortal();
  const fees = selectedChild ? childFeeSummary(selectedChild) : null;

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to view invoices.</p>;
  }

  function printStatement() {
    if (!selectedChild || !fees) return;
    printFeeStatement(selectedChild, fees.ledger);
  }

  const docs = [
    {
      title: "Monthly Invoice",
      desc: `Current month fee statement for ${selectedChild.fullName}`,
    },
    {
      title: "Annual Fee Statement",
      desc: "Full academic year fee summary with paid and outstanding months",
    },
    {
      title: "Outstanding Balance Statement",
      desc: fees ? `Outstanding balance: ${money(fees.outstanding)}` : "",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices & Statements</h1>
        <p className="mt-1 text-sm text-muted-foreground">{selectedChild.fullName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {docs.map((d) => (
          <div key={d.title} className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">{d.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{d.desc}</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => printStatement()}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button onClick={() => printStatement()}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
