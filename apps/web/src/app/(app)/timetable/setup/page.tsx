"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  formatMinutes,
  WEEKDAY_NAMES,
  type FeasibilityReport,
  type SaveShiftInput,
} from "@ekulmis/shared";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { ShiftEditor } from "@/components/timetable/shift-editor";
import { AllocationGrid } from "@/components/timetable/allocation-grid";
import { FeasibilityView } from "@/components/timetable/feasibility-report";
import { RuleComposer } from "@/components/timetable/rule-composer";
import {
  createShift,
  deleteShift,
  fetchAllocation,
  fetchFeasibility,
  deletePreference,
  fetchRules,
  fetchShifts,
  saveAllocation,
  updateShift,
  type AllocationRoom,
  type RulesResponse,
  type ShiftDto,
} from "@/lib/timetable/api";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Shifts & periods" },
  { id: 2, label: "Lesson allocation" },
  { id: 3, label: "Rules" },
  { id: 4, label: "Check" },
] as const;

export default function TimetableSetupPage() {
  const academics = useAcademicsState();
  const [yearId, setYearId] = useState("");
  const [step, setStep] = useState<number>(1);

  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [rooms, setRooms] = useState<AllocationRoom[]>([]);
  const [report, setReport] = useState<FeasibilityReport | null>(null);
  const [rules, setRules] = useState<RulesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<ShiftDto | null | "new">(null);

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  const years = academics.academicYears;
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId(years.find((y) => y.status === "ACTIVE")?.id ?? years[0]!.id);
  }, [years, yearId]);

  const reload = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetchShifts(yearId),
        fetchAllocation(yearId),
      ]);
      setShifts(s);
      setRooms(a.rooms);
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load setup", "error");
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSaveShift(body: SaveShiftInput) {
    const target = editing;
    if (target && target !== "new") await updateShift(target.id, body);
    else await createShift(body);
    toast("Shift saved", "success");
    setEditing(null);
    await reload();
  }

  async function handleDeleteShift(shift: ShiftDto) {
    try {
      await deleteShift(shift.id);
      toast(`"${shift.name}" removed`, "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    }
  }

  function patchAllocation(
    classId: string,
    sectionId: string | null,
    subjectId: string,
    periodsPerWeek: number,
  ) {
    setRooms((prev) =>
      prev.map((room) =>
        room.classId === classId && room.sectionId === sectionId
          ? {
              ...room,
              subjects: room.subjects.map((s) =>
                s.subjectId === subjectId ? { ...s, periodsPerWeek } : s,
              ),
            }
          : room,
      ),
    );
    setDirty(true);
  }

  async function persistAllocation() {
    try {
      await saveAllocation({
        academicYearId: yearId,
        rows: rooms.flatMap((room) =>
          room.subjects.map((s) => ({
            classId: room.classId,
            sectionId: room.sectionId,
            subjectId: s.subjectId,
            periodsPerWeek: s.periodsPerWeek,
          })),
        ),
      });
      setDirty(false);
      toast("Allocation saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  }

  async function runCheck() {
    setChecking(true);
    try {
      setReport(await fetchFeasibility(yearId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Check failed", "error");
    } finally {
      setChecking(false);
    }
  }

  const loadRules = useCallback(async () => {
    if (!yearId) return;
    try {
      setRules(await fetchRules(yearId));
    } catch {
      /* a school with no rules yet is the normal case */
    }
  }, [yearId]);

  useEffect(() => {
    if (step === 3) void loadRules();
  }, [step, loadRules]);

  // The check is the whole point of the wizard, so run it on arrival instead of
  // making the school press another button.
  useEffect(() => {
    if (step === 4 && yearId && !checking) void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, yearId]);

  const totalSlots = useMemo(
    () =>
      shifts.reduce(
        (sum, s) => sum + s.periods.filter((p) => !p.isBreak).length * s.days.length,
        0,
      ),
    [shifts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6" />
            Timetable setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe the school week, then how many periods each subject needs.
          </p>
        </div>
        <div className="w-52">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              step === s.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-secondary",
            )}
          >
            <span className="mr-1.5 text-xs opacity-70">{s.id}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {shifts.length === 0
                    ? "No shift yet. Most schools need one; add a second only if you run a morning and an afternoon group."
                    : `${shifts.length} shift${shifts.length === 1 ? "" : "s"} · ${totalSlots} teaching slots a week in total.`}
                </p>
                <Button type="button" onClick={() => setEditing("new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add shift
                </Button>
              </div>

              {shifts.map((shift) => (
                <div key={shift.id} className="overflow-hidden rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2">
                    <div>
                      <h3 className="text-sm font-semibold">{shift.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {shift.days
                          .map((d) => WEEKDAY_NAMES[d]?.slice(0, 3))
                          .join(", ")}{" "}
                        · {shift.periods.filter((p) => !p.isBreak).length} periods a
                        day
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => setEditing(shift)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleDeleteShift(shift)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {shift.periods.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
                          p.isBreak
                            ? "border-dashed text-muted-foreground"
                            : "bg-background",
                        )}
                      >
                        <Clock className="h-3 w-3 opacity-60" />
                        <strong className="font-medium">{p.name}</strong>
                        {formatMinutes(p.startMinute)}–{formatMinutes(p.endMinute)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <AllocationGrid
              rooms={rooms}
              shifts={shifts}
              onChange={patchAllocation}
              onSave={persistAllocation}
              dirty={dirty}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              {shifts.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Add a shift first — rules are expressed in terms of its periods.
                </p>
              ) : (
                <RuleComposer
                  academicYearId={yearId}
                  shiftId={shifts[0]!.id}
                  onApplied={loadRules}
                />
              )}

              {rules && (rules.unavailability.length > 0 || rules.preferences.length > 0) && (
                <div className="space-y-3">
                  {rules.unavailability.length > 0 && (
                    <div className="overflow-hidden rounded-lg border">
                      <h3 className="border-b bg-secondary/40 px-4 py-2 text-sm font-semibold">
                        Teacher unavailable times
                      </h3>
                      <ul className="divide-y">
                        {rules.unavailability.map((u) => (
                          <li key={u.id} className="px-4 py-2 text-sm">
                            <span className="font-medium">{u.teacher.fullName}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              — {WEEKDAY_NAMES[u.dayOfWeek]}{" "}
                              {formatMinutes(u.startMinute)}–{formatMinutes(u.endMinute)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rules.preferences.length > 0 && (
                    <div className="overflow-hidden rounded-lg border">
                      <h3 className="border-b bg-secondary/40 px-4 py-2 text-sm font-semibold">
                        Time preferences
                        <span className="ml-2 font-normal text-muted-foreground">
                          kept where possible, never at the cost of a valid week
                        </span>
                      </h3>
                      <ul className="divide-y">
                        {rules.preferences.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                          >
                            <span>
                              <span className="font-medium">{p.subject.name}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                in {p.class?.name ?? "every class"} —{" "}
                                {formatMinutes(p.startMinute)}–{formatMinutes(p.endMinute)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await deletePreference(p.id);
                                await loadRules();
                              }}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {dirty && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  You have unsaved allocation changes — save them on step 2 for
                  this check to reflect them.
                </p>
              )}
              {checking || !report ? (
                <div className="flex items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </div>
              ) : (
                <>
                  <FeasibilityView report={report} />
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={runCheck}>
                      Re-check
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "New shift" : `Edit ${editing.name}`}
        >
          <ShiftEditor
            academicYearId={yearId}
            shift={editing === "new" ? null : editing}
            onSave={handleSaveShift}
            onCancel={() => setEditing(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
