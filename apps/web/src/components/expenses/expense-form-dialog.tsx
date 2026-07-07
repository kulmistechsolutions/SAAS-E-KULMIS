"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_ATTACHMENT_TYPES,
  PAYMENT_METHODS,
  paymentMethodLabel,
} from "@/lib/expenses/format";
import {
  createExpense,
  getExpensesState,
  updateExpense,
} from "@/lib/expenses/store";
import type { Expense, ExpenseAttachment, PaymentMethod } from "@/lib/expenses/types";
import { ACADEMIC_YEARS } from "@/lib/students/constants";
import { toast } from "@/lib/toast";

interface ExpenseFormDialogProps {
  open: boolean;
  expense?: Expense | null;
  onClose: () => void;
  onSuccess?: (expense: Expense) => void;
}

export function ExpenseFormDialog({
  open,
  expense,
  onClose,
  onSuccess,
}: ExpenseFormDialogProps) {
  const isEdit = !!expense;
  const state = getExpensesState();
  const activeCategories = state.categories.filter((c) => c.status === "ACTIVE");

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [academicYear, setAcademicYear] = useState(state.academicYear);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paidTo, setPaidTo] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<ExpenseAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cats = getExpensesState().categories.filter((c) => c.status === "ACTIVE");
    if (expense) {
      setTitle(expense.title);
      setCategoryId(expense.categoryId);
      setAmount(String(expense.amount));
      setExpenseDate(expense.expenseDate);
      setAcademicYear(expense.academicYear);
      setPaymentMethod(expense.paymentMethod);
      setPaidTo(expense.paidTo);
      setDescription(expense.description ?? "");
      setAttachment(expense.attachment ?? null);
    } else {
      setTitle("");
      setCategoryId(cats[0]?.id ?? "");
      setAmount("");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setAcademicYear(getExpensesState().academicYear);
      setPaymentMethod("CASH");
      setPaidTo("");
      setDescription("");
      setAttachment(null);
    }
  }, [open, expense]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      toast("Only PDF, JPG, PNG, and JPEG files are allowed.", "error");
      return;
    }
    const maxBytes = state.maxAttachmentMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast(`File exceeds ${state.maxAttachmentMb}MB limit.`, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        id: `att_${Date.now()}`,
        fileName: file.name,
        mimeType: file.type,
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
      toast("Attachment uploaded", "success");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const payload = {
      title,
      categoryId,
      amount: Number(amount),
      expenseDate,
      academicYear,
      paymentMethod,
      paidTo,
      description: description || null,
      attachment,
    };

    const res = isEdit
      ? updateExpense({ id: expense!.id, ...payload })
      : createExpense(payload);
    setSubmitting(false);

    if (!res.ok) {
      toast(res.error ?? "Failed to save expense", "error");
      return;
    }
    toast(isEdit ? "Expense updated" : `Expense ${res.expense?.referenceNo} recorded`, "success");
    if (res.expense) onSuccess?.(res.expense);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Expense" : "Record Expense"}
      description={isEdit ? expense?.referenceNo : "Register a new school operational expense"}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update Expense" : "Record Expense"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exp-title">Expense Title</Label>
          <Input
            id="exp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Monthly Electricity Bill"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="exp-cat">Category</Label>
            <Select
              id="exp-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="exp-date">Expense Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-year">Academic Year</Label>
            <Select
              id="exp-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="exp-method">Payment Method</Label>
            <Select
              id="exp-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel(m)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-vendor">Paid To (Vendor)</Label>
            <Input
              id="exp-vendor"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              placeholder="Supplier name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="exp-desc">Description / Notes</Label>
          <Textarea
            id="exp-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exp-file">Attachment (optional)</Label>
          <Input id="exp-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
          {attachment && (
            <p className="text-xs text-muted-foreground">
              Attached: {attachment.fileName}
              <button
                type="button"
                className="ml-2 text-rose-600 hover:underline"
                onClick={() => setAttachment(null)}
              >
                Remove
              </button>
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
