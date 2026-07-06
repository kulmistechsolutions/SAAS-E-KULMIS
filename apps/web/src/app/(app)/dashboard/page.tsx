"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface FinanceDashboard {
  totalIncome: number;
  totalExpenses: number;
  totalSalaries: number;
  netIncome: number;
  totalOutstanding: number;
}

interface AttendanceDashboard {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  presentPercentage: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const canFinance =
    user?.role === "ADMINISTRATOR" || user?.role === "FINANCE_OFFICER";

  const finance = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => api<FinanceDashboard>("/finance/dashboard"),
    enabled: canFinance,
  });

  const attendance = useQuery({
    queryKey: ["attendance-dashboard", today()],
    queryFn: () =>
      api<AttendanceDashboard>(`/student-attendance/dashboard?date=${today()}`),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {canFinance && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Finance
          </h2>
          {finance.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : finance.data ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat title="Total Income" value={finance.data.totalIncome} />
              <Stat title="Expenses" value={finance.data.totalExpenses} />
              <Stat title="Salaries" value={finance.data.totalSalaries} />
              <Stat title="Net Income" value={finance.data.netIncome} />
              <Stat title="Outstanding" value={finance.data.totalOutstanding} />
            </div>
          ) : null}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          Attendance — Today
        </h2>
        {attendance.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : attendance.data ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat title="Present" value={attendance.data.PRESENT} />
            <Stat title="Absent" value={attendance.data.ABSENT} />
            <Stat title="Late" value={attendance.data.LATE} />
            <Stat
              title="Attendance %"
              value={`${attendance.data.presentPercentage}%`}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
