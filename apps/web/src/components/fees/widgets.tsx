"use client";

import Link from "next/link";
import {
  Calendar,
  FileText,
  Printer,
  Wallet,
} from "lucide-react";
import { AttendanceDonut } from "@/components/dashboard/charts";
import { money } from "@/lib/fees/format";
import type { PaymentSummarySlice } from "@/lib/fees/types";

export function PaymentSummaryWidget({
  slices,
  totalStudents,
}: {
  slices: PaymentSummarySlice[];
  totalStudents: number;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold">Payment Summary</p>
      <div className="mt-2">
        <AttendanceDonut
          segments={slices.map((s) => ({
            name: s.name,
            value: s.amount,
            color: s.color,
          }))}
        />
      </div>
      <div className="mt-2 space-y-2">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              {s.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {money(s.amount)} ({s.percent}%)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t pt-3 text-center text-sm text-muted-foreground">
        Total Students:{" "}
        <span className="font-semibold text-foreground">{totalStudents}</span>
      </p>
    </div>
  );
}

const ACTIONS = [
  {
    label: "Collect Fees",
    href: "/finance/collect",
    icon: Wallet,
    className: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  {
    label: "Monthly Setup",
    href: "/finance/monthly-setup",
    icon: Calendar,
    className: "bg-violet-500 hover:bg-violet-600 text-white",
  },
  {
    label: "Fee Reports",
    href: "/finance/reports",
    icon: FileText,
    className: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  {
    label: "Print Receipt",
    href: "/finance/receipts",
    icon: Printer,
    className: "bg-orange-500 hover:bg-orange-600 text-white",
  },
];

export function FeeQuickActions() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold">Quick Actions</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center text-xs font-semibold shadow-sm transition-transform hover:scale-[1.02] ${a.className}`}
          >
            <a.icon className="h-5 w-5" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function FeeSidebarLegend({ slices }: { slices: PaymentSummarySlice[] }) {
  return (
    <div className="hidden text-xs text-muted-foreground">
      {slices.map((s) => (
        <span key={s.name}>
          {s.name}: {money(s.amount)}
        </span>
      ))}
    </div>
  );
}
