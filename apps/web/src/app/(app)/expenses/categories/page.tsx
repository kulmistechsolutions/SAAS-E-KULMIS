"use client";


import { useT } from "@/lib/i18n/provider";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/expenses/category-badge";
import { createCategory, toggleCategoryStatus, useExpensesState } from "@/lib/expenses/store";
import { toast } from "@/lib/toast";

export default function ExpenseCategoriesPage() {
  const t = useT();
  const state = useExpensesState();
  const [name, setName] = useState("");

  async function handleAdd() {
    const res = await createCategory({ name });
    if (!res.ok) {
      toast(res.error ?? "Failed to add category", "error");
      return;
    }
    toast(`Category "${name}" created`, "success");
    setName("");
  }

  async function handleToggle(id: string) {
    const res = await toggleCategoryStatus(id);
    if (!res.ok) toast(res.error ?? "Failed", "error");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("expensesCategories.expenseCategories")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("expensesCategories.manageCustomCategoriesForSchoolOperational")}
        </p>
      </div>

      <div className="flex max-w-md gap-2">
        <Input
          placeholder={t("expensesCategories.newCategoryName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
        />
        <Button className="h-10 shrink-0" onClick={handleAdd}>
          <Plus className="me-2 h-4 w-4" />
          {t("expensesCategories.add")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("expensesCategories.category")}</th>
              <th className="px-4 py-2.5 font-medium">{t("expensesCategories.status")}</th>
              <th className="px-4 py-2.5 font-medium">{t("expensesCategories.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {state.categories.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2.5">
                  <CategoryBadge name={c.name} />
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={c.status === "ACTIVE" ? "success" : "muted"}>
                    {c.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Button
                    variant="outline"
                    className="h-8"
                    onClick={() => handleToggle(c.id)}
                  >
                    {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
