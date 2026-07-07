"use client";

import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/fees/format";
import {
  activateNextMonth,
  canActivateNextMonth,
  nextActivatableMonth,
} from "@/lib/fees/store";
import { toast } from "@/lib/toast";

interface MonthSetupWidgetProps {
  activeMonthKey: string;
  academicYear: string;
}

export function MonthSetupWidget({
  activeMonthKey,
  academicYear,
}: MonthSetupWidgetProps) {
  const nextKey = nextActivatableMonth();
  const canActivate = canActivateNextMonth();
  const { year, month } = (() => {
    const [y, m] = activeMonthKey.split("-").map(Number);
    return { year: y, month: m };
  })();
  const activateAfterDay = 25;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en", {
    month: "long",
  });

  function handleSetup() {
    const res = activateNextMonth();
    if (!res.ok) toast(res.error ?? "Could not activate month", "error");
    else toast(`Activated ${monthLabel(nextKey)}`, "success");
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Calendar className="h-4 w-4 text-primary" />
        Month Setup
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Current Active Month</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">
            {monthLabel(activeMonthKey)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Academic Year</p>
          <p className="mt-1 text-lg font-bold">{academicYear}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge tone="success" className="mt-1.5" dot>
            Active
          </Badge>
        </div>
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Next Month (Can be activated after {activateAfterDay} {monthName})
          </p>
          <p className="mt-1 text-lg font-bold text-primary">
            {monthLabel(nextKey)}
          </p>
        </div>
      </div>

      <Button
        className="mt-4 h-10 w-full text-sm"
        disabled={!canActivate}
        onClick={handleSetup}
      >
        Setup Next Month
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>

      <Link
        href="/finance/monthly-setup"
        className="mt-3 block text-center text-xs font-medium text-primary hover:underline"
      >
        Open Monthly Setup
      </Link>
    </div>
  );
}
