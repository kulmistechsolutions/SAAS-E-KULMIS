"use client";

import { useState } from "react";
import { Coffee, Plus, Trash2 } from "lucide-react";
import {
  formatMinutes,
  parseTimeToMinutes,
  WEEKDAY_NAMES,
  type SaveShiftInput,
} from "@ekulmis/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ShiftDto } from "@/lib/timetable/api";

interface DraftPeriod {
  name: string;
  start: string;
  end: string;
  isBreak: boolean;
}

function toDraft(shift: ShiftDto | null): DraftPeriod[] {
  if (!shift || shift.periods.length === 0) {
    return [
      { name: "P1", start: "07:50", end: "08:33", isBreak: false },
      { name: "P2", start: "08:33", end: "09:16", isBreak: false },
      { name: "P3", start: "09:16", end: "10:00", isBreak: false },
      { name: "Break", start: "10:00", end: "10:30", isBreak: true },
      { name: "P4", start: "10:30", end: "11:00", isBreak: false },
      { name: "P5", start: "11:00", end: "11:30", isBreak: false },
      { name: "P6", start: "11:30", end: "12:00", isBreak: false },
    ];
  }
  return shift.periods.map((p) => ({
    name: p.name,
    start: formatMinutes(p.startMinute),
    end: formatMinutes(p.endMinute),
    isBreak: p.isBreak,
  }));
}

interface Props {
  academicYearId: string;
  shift: ShiftDto | null;
  onSave: (body: SaveShiftInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * Editor for one shift and its whole daily grid.
 *
 * Each period carries its own start and end rather than a shared duration,
 * because real schools shorten the periods after the break — a single
 * "period length" field cannot describe an actual school day.
 */
export function ShiftEditor({ academicYearId, shift, onSave, onCancel }: Props) {
  const [name, setName] = useState(shift?.name ?? "Morning");
  const [days, setDays] = useState<number[]>(shift?.days ?? [6, 0, 1, 2, 3]);
  const [periods, setPeriods] = useState<DraftPeriod[]>(toDraft(shift));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function patch(index: number, next: Partial<DraftPeriod>) {
    setPeriods((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...next } : p)),
    );
  }

  function addPeriod(isBreak: boolean) {
    const last = periods[periods.length - 1];
    const start = last?.end ?? "08:00";
    const startMin = parseTimeToMinutes(start) ?? 480;
    const teaching = periods.filter((p) => !p.isBreak).length;
    setPeriods((prev) => [
      ...prev,
      {
        name: isBreak ? "Break" : `P${teaching + 1}`,
        start,
        end: formatMinutes(Math.min(startMin + (isBreak ? 30 : 40), 1440)),
        isBreak,
      },
    ]);
  }

  const teachingCount = periods.filter((p) => !p.isBreak).length;

  async function submit() {
    setError(null);
    if (days.length === 0) {
      setError("Pick at least one working day.");
      return;
    }
    const parsed: SaveShiftInput["periods"] = [];
    for (const p of periods) {
      const s = parseTimeToMinutes(p.start);
      const e = parseTimeToMinutes(p.end);
      if (s == null || e == null) {
        setError(`"${p.name}" has an invalid time. Use HH:MM, e.g. 07:50.`);
        return;
      }
      if (e <= s) {
        setError(`"${p.name}" ends before it starts.`);
        return;
      }
      parsed.push({ name: p.name, startMinute: s, endMinute: e, isBreak: p.isBreak });
    }
    // Overlap is rejected by the API and the database too; checking here just
    // gets the school a clearer message without a round trip.
    const sorted = [...parsed].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]!.startMinute < sorted[i - 1]!.endMinute) {
        setError(`"${sorted[i - 1]!.name}" and "${sorted[i]!.name}" overlap.`);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({ academicYearId, name, days, periods: parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the shift.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Shift name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning"
          />
        </div>
      </div>

      <div>
        <Label>Working days</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_NAMES.map((label, day) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                days.includes(day)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-secondary",
              )}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label className="mb-0">
            Daily periods
            <span className="ml-2 font-normal text-muted-foreground">
              {teachingCount} teaching · {days.length} days ={" "}
              <strong className="text-foreground">
                {teachingCount * days.length}
              </strong>{" "}
              slots a week
            </span>
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => addPeriod(false)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Period
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => addPeriod(true)}
            >
              <Coffee className="mr-1 h-3.5 w-3.5" />
              Break
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {periods.map((p, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border p-2",
                p.isBreak && "bg-secondary/50",
              )}
            >
              <Input
                className="h-9 w-28"
                value={p.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <Input
                className="h-9 w-24"
                value={p.start}
                onChange={(e) => patch(i, { start: e.target.value })}
                placeholder="07:50"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                className="h-9 w-24"
                value={p.end}
                onChange={(e) => patch(i, { end: e.target.value })}
                placeholder="08:33"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={p.isBreak}
                  onChange={(e) => patch(i, { isBreak: e.target.checked })}
                />
                Break
              </label>
              <button
                type="button"
                onClick={() => setPeriods((prev) => prev.filter((_, x) => x !== i))}
                className="ml-auto text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${p.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save shift"}
        </Button>
      </div>
    </div>
  );
}
