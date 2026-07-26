"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { CategoryBadge } from "@/components/expenses/category-badge";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { money, paymentMethodLabel } from "@/lib/expenses/format";
import { printExpense } from "@/lib/expenses/print";
import {
  deleteExpense,
  exportExpensesCsv,
  getExpense,
  listExpenses,
  useExpensesState,
} from "@/lib/expenses/store";
import type { Expense, ExpenseSortDir, ExpenseSortKey } from "@/lib/expenses/types";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 15;

export default function ExpenseListPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const state = useExpensesState();
  const [search, setSearch] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<ExpenseSortKey>("expenseDate");
  const [sortDir, setSortDir] = useState<ExpenseSortDir>("desc");
  const [page, setPage] = useState(1);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) setAcademicYear(state.academicYear);
  }, [mounted, state.academicYear]);
  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") setShowCreate(true);
  }, [mounted]);

  const rows = useMemo(
    () =>
      mounted
        ? listExpenses({
            academicYear,
            categoryId: categoryId || undefined,
            paymentMethod: paymentMethod || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            search,
            sortKey,
            sortDir,
          })
        : [],
    [
      mounted,
      academicYear,
      categoryId,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
      sortKey,
      sortDir,
      state,
    ],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteId) return;
    const res = await deleteExpense(deleteId);
    if (!res.ok) {
      toast(res.error ?? "Delete failed", "error");
      return;
    }
    toast("Expense deleted (admin authorization required)", "success");
    setDeleteId(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("expensesList.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("expensesList.expenseList")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("expensesList.allRecordedSchoolOperationalExpenses")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9" onClick={() => exportExpensesCsv(rows)}>
            <Download className="mr-2 h-4 w-4" />
            {t("expensesList.exportCsv")}
          </Button>
          <Button className="h-9" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("expensesList.recordExpense")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t("expensesList.searchReferenceTitleCategoryVendor")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
        <AcademicYearSelect
          value={academicYear}
          onChange={(v) => {
            setAcademicYear(v);
            setPage(1);
          }}
          className="h-9 min-w-[130px]"
        />
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[160px]"
        >
          <option value="">{t("expensesList.allCategories")}</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[150px]"
        >
          <option value="">{t("expensesList.allMethods")}</option>
          <option value="CASH">{t("expensesList.cash")}</option>
          <option value="BANK_TRANSFER">{t("expensesList.bankTransfer")}</option>
          <option value="MOBILE_MONEY">{t("expensesList.mobileMoney")}</option>
          <option value="CHEQUE">{t("expensesList.cheque")}</option>
          <option value="OTHER">{t("expensesList.other")}</option>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="h-9 w-[140px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="h-9 w-[140px]"
        />
        <Select
          value={`${sortKey}-${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split("-") as [ExpenseSortKey, ExpenseSortDir];
            setSortKey(k);
            setSortDir(d);
          }}
          className="h-9 min-w-[150px]"
        >
          <option value="expenseDate-desc">{t("expensesList.dateNewest")}</option>
          <option value="expenseDate-asc">{t("expensesList.dateOldest")}</option>
          <option value="amount-desc">{t("expensesList.amountHigh")}</option>
          <option value="amount-asc">{t("expensesList.amountLow")}</option>
          <option value="category-asc">{t("expensesList.categoryAZ")}</option>
          <option value="title-asc">{t("expensesList.titleAZ")}</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.reference")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.title")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.category")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.amount")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.method")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.date")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.recordedBy")}</th>
                <th className="px-4 py-2.5 font-medium">{t("expensesList.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5 text-muted-foreground">{r.serial}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-primary">
                    {r.referenceNo}
                  </td>
                  <td className="px-4 py-2.5">{r.title}</td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge name={r.categoryName} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-rose-600">
                    {money(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {paymentMethodLabel(r.paymentMethod)}
                  </td>
                  <td className="px-4 py-2.5">{r.expenseDate}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.recordedBy}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Link
                        href={`/expenses/${r.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const exp = getExpense(r.id);
                          if (exp) setEditExpense(exp);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const exp = getExpense(r.id);
                          if (exp) printExpense(exp);
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 text-rose-600"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={rows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ExpenseFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
      <ExpenseFormDialog
        open={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
      <ConfirmDialog
        open={!!deleteId}
        title={t("expensesList.deleteExpense")}
        message={t("expensesList.thisRequiresAdministratorAuthorizationTheExpense")}
        confirmLabel={t("expensesList.authorizeDelete")}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
