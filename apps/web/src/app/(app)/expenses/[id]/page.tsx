"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/expenses/category-badge";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import {
  dateTime,
  money,
  paymentMethodLabel,
  shortDate,
} from "@/lib/expenses/format";
import { printExpense } from "@/lib/expenses/print";
import { categoryName, getExpense } from "@/lib/expenses/store";

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const expense = useMemo(() => getExpense(id), [id]);

  if (!expense || expense.status === "DELETED") {
    return (
      <div className="space-y-4">
        <Link href="/expenses/list" className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <p className="text-muted-foreground">Expense not found.</p>
      </div>
    );
  }

  const cat = categoryName(expense.categoryId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/expenses/list" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />
            Expense List
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{expense.title}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{expense.referenceNo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" className="h-9" onClick={() => printExpense(expense)}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => printExpense(expense)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Expense Details</h2>
              <Badge tone={expense.status === "RECORDED" ? "success" : "warning"}>
                {expense.status}
              </Badge>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Category" value={<CategoryBadge name={cat} />} />
              <Detail label="Amount" value={money(expense.amount)} highlight />
              <Detail label="Payment Method" value={paymentMethodLabel(expense.paymentMethod)} />
              <Detail label="Expense Date" value={shortDate(expense.expenseDate)} />
              <Detail label="Vendor / Paid To" value={expense.paidTo} />
              <Detail label="Academic Year" value={expense.academicYear} />
              <Detail label="Recorded By" value={expense.recordedBy} />
              <Detail label="Created" value={dateTime(expense.createdAt)} />
              <Detail label="Last Updated" value={dateTime(expense.updatedAt)} />
            </dl>
            {expense.description && (
              <div className="mt-4 rounded-lg bg-secondary/40 p-4 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="mt-1">{expense.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {expense.attachment ? (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Attachment</h2>
              <p className="mt-1 text-sm text-muted-foreground">{expense.attachment.fileName}</p>
              {expense.attachment.mimeType.startsWith("image/") ? (
                <img
                  src={expense.attachment.dataUrl}
                  alt={expense.attachment.fileName}
                  className="mt-3 max-h-64 rounded-lg border object-contain"
                />
              ) : (
                <a
                  href={expense.attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  Open attachment
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-5 text-center text-sm text-muted-foreground">
              No attachment uploaded
            </div>
          )}
        </div>
      </div>

      <ExpenseFormDialog
        open={editing}
        expense={expense}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${highlight ? "text-2xl text-rose-600 tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
