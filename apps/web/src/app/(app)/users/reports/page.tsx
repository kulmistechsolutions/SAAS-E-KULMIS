"use client";

import { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printUserListReport } from "@/lib/users/print";
import { exportUsersCsv, listUsers, useUsersState } from "@/lib/users/store";

export default function UserReportsPage() {
  const state = useUsersState();

  const allUsers = useMemo(() => listUsers(), [state]);
  const active = useMemo(() => listUsers({ status: "ACTIVE" }), [state]);
  const inactive = useMemo(() => listUsers({ status: "INACTIVE" }), [state]);
  const locked = useMemo(() => listUsers({ status: "LOCKED" }), [state]);

  const standardReports = [
    { title: "User List", rows: allUsers },
    { title: "Active Users", rows: active },
    { title: "Inactive Users", rows: inactive },
    { title: "Locked Accounts", rows: locked },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Print or export user and access reports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {standardReports.map((report) => (
          <div key={report.title} className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">{report.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.rows.length} records</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="h-9"
                onClick={() =>
                  printUserListReport(
                    report.rows.map((r) => ({
                      userId: r.userId,
                      fullName: r.fullName,
                      username: r.username,
                      roleLabel: r.roleLabel,
                      status: r.status,
                    })),
                    report.title,
                  )
                }
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                className="h-9"
                onClick={() => exportUsersCsv(report.rows)}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
        ))}

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Role Summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">{state.roles.length} roles defined</p>
          <ul className="mt-3 space-y-2 text-sm">
            {state.roles.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {listUsers({ role: r.name }).length} users
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Login History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent sessions ({state.sessions.length} records).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Login</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.slice(0, 12).map((s) => {
                const u = state.users.find((x) => x.id === s.userId);
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{u?.fullName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.loginAt.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2">{s.device}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.ipAddress}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
