"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { apiSetupAcademicYear, apiFeeSettings } from "@/lib/fees/api";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function AcademicYearSetupPage() {
  const { year: academicYearName, setYear: setAcademicYear } =
    useAcademicYearSelect("fee-ay-setup");
  const academics = useAcademicsState();
  const [settings, setSettings] = useState<{
    feeAcademicMonths: number;
    feeBillingStartMonth: number;
    feeBillingEndMonth: number;
    billingMode: string;
  } | null>(null);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void ensureAcademicsLoaded();
    void apiFeeSettings()
      .then((s) => setSettings(s))
      .catch(() => toast("Could not load fee settings", "error"));
  }, []);

  const yearId = academics.academicYears.find(
    (y) => y.name === academicYearName,
  )?.id;
  const months = settings?.feeAcademicMonths ?? 10;
  const fee = Number(monthlyFee) || 0;
  const totalAnnual = fee * months;

  async function handleActivate() {
    if (!yearId) {
      toast("Select a valid academic year", "error");
      return;
    }
    if (settings?.billingMode !== "ACADEMIC_YEAR") {
      toast("Switch to Academic Year billing in Settings → Fees first", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await apiSetupAcademicYear({
        academicYearId: yearId,
        academicMonths: months,
        monthlyFee: fee || undefined,
        billingStartMonth: settings?.feeBillingStartMonth,
        billingEndMonth: settings?.feeBillingEndMonth,
      });
      toast(
        `Activated ${res.chargesCreated} month records for ${res.studentsProcessed} students`,
        "success",
      );
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Setup failed",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic Year Fee Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Charge the full academic year upfront (Monthly Fee × Academic Months) while
          tracking month-by-month payment progress.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label>Academic Year</Label>
          <AcademicYearSelect value={academicYearName} onChange={setAcademicYear} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Academic Months</Label>
            <Input type="number" value={months} readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>Default Monthly Fee (optional)</Label>
            <Input
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="Uses each student's monthly fee if empty"
            />
          </div>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4">
          <p className="text-xs text-muted-foreground">Total Annual Tuition (per student)</p>
          <p className="text-2xl font-bold tabular-nums">
            {fee > 0 ? `$${totalAnnual}` : "Monthly Fee × " + months}
          </p>
        </div>
        <Button className="w-full" disabled={loading || !yearId} onClick={() => void handleActivate()}>
          {loading ? "Activating…" : "Activate Academic Year Billing"}
        </Button>
      </div>
    </div>
  );
}
