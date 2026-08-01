"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, CalendarX, Loader2, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  apiClassResetPreview,
  apiDeleteMonth,
  apiFeeResetPreview,
  apiListActivatedMonths,
  apiResetClass,
  apiResetFees,
  apiResetSchool,
  apiResetTeachers,
  apiSchoolResetPreview,
  apiTeacherResetPreview,
  type ApiActivatedMonth,
  type ApiClassResetPreview,
  type ApiFeeResetPreview,
  type ApiSchoolResetPreview,
  type ApiTeacherResetPreview,
} from "@/lib/students/api";
import { monthLabel, money as feeMoney } from "@/lib/fees/format";
import { schoolBranding } from "@/lib/settings/store";
import {
  ensureAcademicsLoaded,
  getAcademicsState,
  useAcademicsState,
} from "@/lib/academics/store";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import { toast } from "@/lib/toast";

export default function DangerZonePage() {
  const t = useT();
  const router = useRouter();
  const isSuper = useIsSchoolSuperAdmin();

  useEffect(() => {
    if (!isSuper) router.replace("/settings");
  }, [isSuper, router]);
  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  if (!isSuper) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsDangerZone.dangerZone")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("settingsDangerZone.deliberateResetsNormalDeletesKeepStudent")}
        </p>
      </div>

      <ClassResetCard />
      <MonthDeleteCard />
      <TeacherResetCard />
      <FeeResetCard />
      <SchoolResetCard />
    </div>
  );
}

/** Erase every teacher and restart teacher numbering at 1. */
function TeacherResetCard() {
  const t = useT();
  const [preview, setPreview] = useState<ApiTeacherResetPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    try {
      setPreview(await apiTeacherResetPreview());
      setOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load", "error");
    }
  }

  const confirmed = !!preview && typed.trim() === preview.name;

  async function handleReset() {
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await apiResetTeachers(typed.trim());
      toast(
        `${res.teachersDeleted} teachers erased. Teacher numbering restarts at 1.`,
        "success",
      );
      setOpen(false);
      setTyped("");
      setPreview(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const c = preview?.counts;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
        <Users className="h-4 w-4" />
        {t("settingsDangerZone.resetAllTeachers")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settingsDangerZone.delete")} <strong>{t("settingsDangerZone.every")}</strong> {t("settingsDangerZone.teacherTheirLoginsClassAndSubject")}
      </p>

      {!open ? (
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => void loadPreview()}
        >
          <Users className="me-2 h-4 w-4" />
          {t("settingsDangerZone.resetAllTeachers")}
        </Button>
      ) : c && preview ? (
        <div className="mt-4 max-w-md space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-card p-3 text-sm sm:grid-cols-3">
            <Count label={t("settingsDangerZone.teachers")} value={c.teachers} strong />
            <Count label={t("settingsDangerZone.assignments")} value={c.assignments} />
            <Count label={t("settingsDangerZone.attendance")} value={c.attendance} />
            <Count label={t("settingsDangerZone.quizzes")} value={c.quizzes} />
            <Count label={t("settingsDangerZone.timetableSlots")} value={c.timetableEntries} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settingsDangerZone.typeTheSchoolName")}{" "}
              <span className="font-mono">{preview.name}</span> {t("settingsDangerZone.toConfirm")}
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={preview.name}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
            >
              {t("settingsDangerZone.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void handleReset()}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settingsDangerZone.resetting")}
                </>
              ) : (
                "Erase all teachers & restart at 1"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Undo one month's billing activation — only while nothing has been paid against it. */
function MonthDeleteCard() {
  const t = useT();
  const schoolName = schoolBranding().name;
  const [months, setMonths] = useState<ApiActivatedMonth[] | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [picked, setPicked] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadMonths() {
    setLoadingMonths(true);
    try {
      setMonths(await apiListActivatedMonths());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load", "error");
    } finally {
      setLoadingMonths(false);
    }
  }

  useEffect(() => {
    void loadMonths();
  }, []);

  const selected = months?.find((m) => `${m.year}-${m.month}` === picked) ?? null;
  const confirmed = !!selected && typed.trim() === schoolName;

  async function handleDelete() {
    if (!selected || !confirmed) return;
    setBusy(true);
    try {
      const res = await apiDeleteMonth(selected.year, selected.month, typed.trim());
      toast(
        `${monthLabel(`${res.year}-${String(res.month).padStart(2, "0")}`)} undone — ${res.chargesDeleted} charges and ${res.activationsDeleted} activation(s) erased.`,
        "success",
      );
      setPicked("");
      setTyped("");
      void loadMonths();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not undo this month", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarX className="h-4 w-4 text-amber-600" />
        Undo a Month&apos;s Billing
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        For a month turned on by mistake — before it should have started, or before setup was
        actually ready. Only available while nothing has been paid against it yet.
      </p>

      <div className="mt-4 max-w-md space-y-3">
        {loadingMonths ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("settingsDangerZone.counting")}
          </p>
        ) : !months || months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No month has been activated yet.</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Month</label>
              <Select
                value={picked}
                onChange={(e) => {
                  setPicked(e.target.value);
                  setTyped("");
                }}
              >
                <option value="">Select a month</option>
                {months.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {monthLabel(`${m.year}-${String(m.month).padStart(2, "0")}`)}
                    {m.hasPayments ? " — has payments" : ""}
                  </option>
                ))}
              </Select>
            </div>

            {selected && (
              <div className="rounded-lg border bg-card p-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  <Count label="Classes" value={selected.classesActivated} />
                  <Count label="Charges" value={selected.chargesCount} strong />
                  <Count label="Charged" value={selected.totalCharged} isMoney />
                  <Count label="Paid" value={selected.totalPaid} isMoney />
                </div>
                {selected.hasPayments ? (
                  <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                    {feeMoney(selected.totalPaid)} has already been paid against this month — it
                    can&apos;t be undone without breaking the payment record. Use Reset All Fees
                    below if you need to clear everything.
                  </p>
                ) : null}
              </div>
            )}

            {selected && !selected.hasPayments && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("settingsDangerZone.typeTheSchoolName")}{" "}
                  <span className="font-mono">{schoolName}</span>{" "}
                  {t("settingsDangerZone.toConfirm")}
                </label>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={schoolName}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
            )}

            {selected && !selected.hasPayments && (
              <Button
                variant="destructive"
                disabled={!confirmed || busy}
                onClick={() => void handleDelete()}
              >
                {busy ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settingsDangerZone.resetting")}
                  </>
                ) : (
                  "Undo this month"
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Erase every fee charge, payment, and billing activation. Students and classes are kept. */
function FeeResetCard() {
  const t = useT();
  const [preview, setPreview] = useState<ApiFeeResetPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    try {
      setPreview(await apiFeeResetPreview());
      setOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load", "error");
    }
  }

  const confirmed = !!preview && typed.trim() === preview.name;

  async function handleReset() {
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await apiResetFees(typed.trim());
      toast(
        `${res.chargesDeleted} charges and ${res.paymentsDeleted} payments erased.`,
        "success",
      );
      setOpen(false);
      setTyped("");
      setPreview(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const c = preview?.counts;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
        <Banknote className="h-4 w-4" />
        Reset All Fees
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settingsDangerZone.delete")} <strong>{t("settingsDangerZone.every")}</strong> fee
        charge, payment, and billing activation in the school. Students, classes, and fee
        settings are kept — this clears the money trail, not the people.
      </p>

      {!open ? (
        <Button variant="destructive" className="mt-4" onClick={() => void loadPreview()}>
          <Banknote className="me-2 h-4 w-4" />
          Reset All Fees
        </Button>
      ) : c && preview ? (
        <div className="mt-4 max-w-md space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-card p-3 text-sm sm:grid-cols-3">
            <Count label="Charges" value={c.charges} strong />
            <Count label="Payments" value={c.payments} strong />
            <Count label="Monthly activations" value={c.monthlyActivations} />
            <Count label="Yearly setups" value={c.yearlySetups} />
            <Count label="Extra fees" value={c.extraFees} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settingsDangerZone.typeTheSchoolName")}{" "}
              <span className="font-mono">{preview.name}</span> {t("settingsDangerZone.toConfirm")}
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={preview.name}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
            >
              {t("settingsDangerZone.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void handleReset()}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settingsDangerZone.resetting")}
                </>
              ) : (
                "Erase all fee data"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Count({
  label,
  value,
  strong,
  isMoney,
}: {
  label: string;
  value: number;
  strong?: boolean;
  isMoney?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold" : "font-medium"}`}>
        {isMoney ? feeMoney(value) : value}
      </span>
    </div>
  );
}

/** Reset a single class — delete its students, keep the class for re-import. */
function ClassResetCard() {
  const t = useT();
  useAcademicsState(); // re-render when classes load
  const classes = useMemo(
    () =>
      getAcademicsState()
        .classes.slice()
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAcademicsState().classes],
  );

  const [classId, setClassId] = useState("");
  const [preview, setPreview] = useState<ApiClassResetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreview(null);
    setTyped("");
    if (!classId) return;
    setLoading(true);
    let active = true;
    void apiClassResetPreview(classId)
      .then((r) => active && setPreview(r))
      .catch((e) =>
        toast(e instanceof Error ? e.message : "Could not load", "error"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [classId]);

  const confirmed = !!preview && typed.trim() === preview.name;

  async function handleReset() {
    if (!classId || !confirmed) return;
    setBusy(true);
    try {
      const res = await apiResetClass(classId, typed.trim());
      toast(
        `${res.name} reset — ${res.studentsDeleted} students erased. The class is kept.`,
        "success",
      );
      setClassId("");
      setPreview(null);
      setTyped("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-2 font-semibold">
        <RotateCcw className="h-4 w-4 text-amber-600" />
        {t("settingsDangerZone.resetOneClass")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settingsDangerZone.eraseEveryStudentInAClass")}
      </p>

      <div className="mt-4 max-w-md space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("settingsDangerZone.class")}</label>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t("settingsDangerZone.selectAClass")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.academicYear ? ` · ${c.academicYear}` : ""}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("settingsDangerZone.counting")}
          </p>
        ) : preview ? (
          <>
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p>
                <span className="font-bold">{preview.counts.students}</span>{" "}
                {t("settingsDangerZone.studentsAnd")}{" "}
                <span className="font-bold">{preview.counts.parents}</span>{" "}
                {t("settingsDangerZone.parentsWillBeDeleted")}
              </p>
              {preview.counts.parentsKept > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.counts.parentsKept} {t("settingsDangerZone.parent")}
                  {preview.counts.parentsKept === 1 ? "" : "s"} {t("settingsDangerZone.keptTheyHaveChildrenInOther")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("settingsDangerZone.type")} <span className="font-mono">{preview.name}</span> {t("settingsDangerZone.toConfirm")}
              </label>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={preview.name}
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <Button
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void handleReset()}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settingsDangerZone.resetting")}
                </>
              ) : (
                "Reset this class"
              )}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Reset the whole school — delete all students and restart numbering at 1. */
function SchoolResetCard() {
  const t = useT();
  const [preview, setPreview] = useState<ApiSchoolResetPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    try {
      setPreview(await apiSchoolResetPreview());
      setOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load", "error");
    }
  }

  const confirmed = !!preview && typed.trim() === preview.name;

  async function handleReset() {
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await apiResetSchool(typed.trim());
      toast(
        `${res.name} reset — ${res.studentsDeleted} students erased. Numbering restarts at 1.`,
        "success",
      );
      setOpen(false);
      setTyped("");
      setPreview(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-300 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
        <AlertTriangle className="h-4 w-4" />
        {t("settingsDangerZone.resetTheWholeSchool")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settingsDangerZone.delete")} <strong>{t("settingsDangerZone.every")}</strong> {t("settingsDangerZone.studentAndParentInTheSchool")}
      </p>

      {!open ? (
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => void loadPreview()}
        >
          <AlertTriangle className="me-2 h-4 w-4" />
          {t("settingsDangerZone.resetEntireSchool")}
        </Button>
      ) : preview ? (
        <div className="mt-4 max-w-md space-y-3">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p>
              {t("settingsDangerZone.thisDeletes")}{" "}
              <span className="font-bold">{preview.counts.students}</span>{" "}
              {t("settingsDangerZone.studentsAnd")}{" "}
              <span className="font-bold">{preview.counts.parents}</span>{" "}
              {t("settingsDangerZone.parentsNumberingRestartsAt1")}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settingsDangerZone.typeTheSchoolName")}{" "}
              <span className="font-mono">{preview.name}</span> {t("settingsDangerZone.toConfirm")}
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={preview.name}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
            >
              {t("settingsDangerZone.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void handleReset()}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settingsDangerZone.resetting")}
                </>
              ) : (
                "Erase all students & restart at 1"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
