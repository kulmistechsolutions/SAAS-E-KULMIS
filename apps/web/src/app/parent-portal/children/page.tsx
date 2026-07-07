"use client";

import Link from "next/link";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { genderLabel, statusLabel } from "@/lib/students/format";

export default function ParentChildrenPage() {
  const { children } = usePortal();
  usePortalAudit("STUDENT_VIEWED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Children</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All students linked to your parent account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {c.fullName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.fullName}</p>
                <p className="text-sm text-muted-foreground">{c.code}</p>
                <Badge tone={c.status === "ACTIVE" ? "success" : "muted"} className="mt-2">
                  {statusLabel(c.status)}
                </Badge>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Class</dt>
                <dd>{c.className}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Section</dt>
                <dd>{c.section ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Academic Year</dt>
                <dd>{c.academicYear}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Gender</dt>
                <dd>{genderLabel(c.gender)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Link href={`/parent-portal/attendance?child=${c.id}`} className="flex-1">
                <Button className="w-full">View details</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
