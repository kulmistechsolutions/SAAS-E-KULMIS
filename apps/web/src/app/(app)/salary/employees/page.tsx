"use client";

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
        Loading employees…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salary profiles for teachers and school staff.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or employee ID…"
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
          <option value="">All positions</option>
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
          <option value="">All types</option>
          <option value="TEACHER">Teachers</option>
          <option value="STAFF">Staff</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Employee ID</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Position</th>
                <th className="px-4 py-2.5 font-medium">Basic</th>
                <th className="px-4 py-2.5 font-medium">Allowances</th>
                <th className="px-4 py-2.5 font-medium">Bonus</th>
                <th className="px-4 py-2.5 font-medium">Deductions</th>
                <th className="px-4 py-2.5 font-medium">Net</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
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
        Joining dates range from {shortDate(pageRows[0]?.joiningDate)} — teachers are synced from Teacher Management.
      </p>
    </div>
  );
}
