"use client";

import { useEffect, useMemo, useState } from "react";
import { MonitoringTable } from "@/components/examinations/widgets";
import { monitoringRows } from "@/lib/examinations/store";

export default function ExamMonitoringPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rows = useMemo(() => (mounted ? monitoringRows() : []), [mounted]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track teacher submissions across all examinations.
        </p>
      </div>
      {mounted && <MonitoringTable rows={rows} />}
    </div>
  );
}
