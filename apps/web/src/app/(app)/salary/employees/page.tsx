"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import {
  money,
  netSalary,
  POSITIONS,
  paymentMethodLabel,
  shortDate,
} from "@/lib/salary/format";
import { useSalaryState } from "@/lib/salary/store";
import type { EmployeeType, Position } from "@/lib/salary/types";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 15;

export default function SalaryEmployeesPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const state = useSalaryState();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [type, setType] = useState<EmployeeType | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => setMounted(true), []);

  const rows = useMemo(() => {
    if (!mounted) return [];
    const q = search.trim().toLowerCase();
    return state.employees.filter((e) => {
      if (position && e.position !== position) return false;
      if (type && e.type !== type) return false;
      if (q) {
        const hay = `${e.code} ${e.fullName} ${e.position}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mounted, state.employees, search, position, type]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("salaryEmployees.loadingEmployees")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("salaryEmployees.employees")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("salaryEmployees.salaryProfilesForTeachersAndSchool")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t("salaryEmployees.searchNameOrEmployeeId")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
        <Select
          value={position}
          onChange={(e) => {
            setPosition(e.target.value as Position | "");
            setPage(1);
          }}
          className="h-9 min-w-[160px]"
        >
          <option value="">{t("salaryEmployees.allPositions")}</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as EmployeeType | "");
            setPage(1);
          }}
          className="h-9 min-w-[140px]"
        >
          <option value="">{t("salaryEmployees.allTypes")}</option>
          <option value="TEACHER">{t("salaryEmployees.teachers")}</option>
          <option value="STAFF">{t("salaryEmployees.staff")}</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.employeeId")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.name")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.position")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.basic")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.allowances")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.bonus")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.deductions")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.net")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.payment")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.status")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => {
                const net = netSalary(
                  e.basicSalary,
                  e.allowances,
                  e.bonus,
                  e.deductions,
                );
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2.5 font-mono text-xs">{e.code}</td>
                    <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.position}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(e.basicSalary)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(e.allowances)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(e.bonus)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(e.deductions)}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold">{money(net)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {paymentMethodLabel(e.paymentMethod)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={e.employmentStatus === "ACTIVE" ? "success" : "muted"}>
                        {e.employmentStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
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

      <p className="text-xs text-muted-foreground">
        {t("salaryEmployees.joiningDatesRangeFrom")} {shortDate(pageRows[0]?.joiningDate)} {t("salaryEmployees.teachersAreSyncedFromTeacherManagement")}
      </p>
    </div>
  );
}
