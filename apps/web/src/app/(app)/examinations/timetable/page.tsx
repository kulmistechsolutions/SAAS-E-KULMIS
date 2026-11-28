"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckSquare,
  DoorOpen,
  LayoutGrid,
  ListOrdered,
  Pencil,
  Plus,
  Printer,
  Shuffle,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ExamNavBar } from "@/components/examinations/widgets";
import { ExportMenu } from "@/components/export/export-menu";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { activeAcademicYear, classNamesForYear, useAcademicsState } from "@/lib/academics/store";
import { useStudentsState } from "@/lib/students/store";
import {
  apiCreateRoom,
  apiCreateTimetable,
  apiDeleteRoom,
  apiDeleteTimetable,
  apiRooms,
  apiTimetables,
  apiUpdateRoom,
  apiUpdateTimetable,
  type ExamRoom,
  type ExamTimetable,
  type TimetableEntry,
} from "@/lib/exam-schedule/api";
import { countClashes, generateSeating, seatLabel } from "@/lib/exam-schedule/seating";
import {
  colourFor,
  durationText,
  longDate,
  printDoorLists,
  printSeatMaps,
  printTimetable,
  type SeatStudentInfo,
} from "@/lib/exam-schedule/print";

type Tab = "timetable" | "rooms" | "seating";

function err(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}
function newId() {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Exam timetable, exam rooms and mixed seating — one page, three tabs.
 *
 * The timetable says which paper each class sits, on which day, from when
 * to when, and where. Rooms are the halls with their rows and columns of
 * desks. Seating mixes the classes into those rooms so no two students of
 * one class sit side by side or one behind the other, then prints a seat
 * map for each room and the list for its door.
 */
export default function ExamTimetablePage() {
  const mounted = useHydrated();
  const academics = useAcademicsState();
  const studentsState = useStudentsState();
  const [tab, setTab] = useState<Tab>("timetable");
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [timetables, setTimetables] = useState<ExamTimetable[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([apiRooms(), apiTimetables()]);
      setRooms(r);
      setTimetables(t);
      setCurrentId((id) => id || t[0]?.id || "");
    } catch (e) {
      toast(err(e, "Could not load the exam timetable."), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) void load();
  }, [mounted, load]);

  const current = timetables.find((t) => t.id === currentId) ?? null;

  async function save(patch: Parameters<typeof apiUpdateTimetable>[1]): Promise<boolean> {
    if (!current) return false;
    try {
      const next = await apiUpdateTimetable(current.id, patch);
      setTimetables((list) => list.map((t) => (t.id === next.id ? next : t)));
      return true;
    } catch (e) {
      toast(err(e, "Could not save."), "error");
      return false;
    }
  }

  const year = current?.academicYear || activeAcademicYear();
  const classes = useMemo(() => (mounted ? classNamesForYear(year) : []), [mounted, year, academics.classes]);
  const subjects = useMemo(
    () => [...new Set((academics.subjects ?? []).map((s) => s.name))].sort(),
    [academics.subjects],
  );

  if (!mounted) return null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-72 rounded-b-[3rem] bg-gradient-to-br from-violet-200/50 via-indigo-100/30 to-transparent dark:from-violet-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
          <CalendarClock className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Exam Timetable & Rooms</h1>
          <p className="text-sm text-muted-foreground">
            Which paper, which day, what time and where — and a mixed seating plan for every room.
          </p>
        </div>
      </div>

      <div className="relative">
        <ExamNavBar />
      </div>

      <TimetablePicker
        timetables={timetables}
        currentId={currentId}
        setCurrentId={setCurrentId}
        onCreated={(t) => {
          setTimetables((l) => [t, ...l]);
          setCurrentId(t.id);
        }}
        onDeleted={(id) => {
          setTimetables((l) => l.filter((t) => t.id !== id));
          setCurrentId(timetables.find((t) => t.id !== id)?.id ?? "");
        }}
        onRenamed={(t) => setTimetables((l) => l.map((x) => (x.id === t.id ? t : x)))}
      />

      <div className="relative rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap gap-1 border-b px-3 pt-2">
          {(
            [
              ["timetable", "Timetable", CalendarClock],
              ["rooms", "Rooms", DoorOpen],
              ["seating", "Mixed Seating", LayoutGrid],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === "rooms" ? (
            <RoomsTab rooms={rooms} setRooms={setRooms} />
          ) : !current ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Create a timetable above to start — for example “First Term Exams 2026”.
            </p>
          ) : tab === "timetable" ? (
            <TimetableTab t={current} rooms={rooms} classes={classes} subjects={subjects} save={save} />
          ) : (
            <SeatingTab
              t={current}
              rooms={rooms}
              classes={classes}
              students={studentsState.students
                .filter((s) => s.status === "ACTIVE")
                .map((s) => ({ id: s.id, code: s.code, fullName: s.fullName, className: s.className }))}
              save={save}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function TimetablePicker({
  timetables,
  currentId,
  setCurrentId,
  onCreated,
  onDeleted,
  onRenamed,
}: {
  timetables: ExamTimetable[];
  currentId: string;
  setCurrentId: (id: string) => void;
  onCreated: (t: ExamTimetable) => void;
  onDeleted: (id: string) => void;
  onRenamed: (t: ExamTimetable) => void;
}) {
  const [open, setOpen] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const current = timetables.find((t) => t.id === currentId);

  async function submit() {
    if (!name.trim()) return;
    try {
      if (open === "new") onCreated(await apiCreateTimetable({ name: name.trim(), academicYear: activeAcademicYear() }));
      else if (current) onRenamed(await apiUpdateTimetable(current.id, { name: name.trim() }));
      setOpen(null);
    } catch (e) {
      toast(err(e, "Could not save the timetable."), "error");
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border bg-card/90 p-3 shadow-sm">
      <Label className="me-1 text-sm">Timetable</Label>
      <Select className="h-9 min-w-[220px] flex-1 sm:flex-none" value={currentId} onChange={(e) => setCurrentId(e.target.value)}>
        {timetables.length === 0 && <option value="">No timetable yet</option>}
        {timetables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.academicYear}
          </option>
        ))}
      </Select>
      <Button className="h-9" onClick={() => { setName(""); setOpen("new"); }}>
        <Plus className="me-1.5 h-4 w-4" /> New timetable
      </Button>
      {current && (
        <>
          <Button variant="outline" className="h-9" onClick={() => { setName(current.name); setOpen("rename"); }}>
            <Pencil className="me-1.5 h-4 w-4" /> Rename
          </Button>
          <Button variant="outline" className="h-9 text-rose-600" onClick={() => setConfirm(true)}>
            <Trash2 className="me-1.5 h-4 w-4" /> Delete
          </Button>
        </>
      )}
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === "new" ? "New exam timetable" : "Rename timetable"}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={() => void submit()}>Save</Button>
          </>
        }
      >
        <Label>Name</Label>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First Term Exams 2026" />
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Delete this timetable?"
        message={`${current?.name ?? ""} — its papers and seating plan are deleted. Rooms stay. This cannot be undone.`}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (!current) return;
          try {
            await apiDeleteTimetable(current.id);
            onDeleted(current.id);
          } catch (e) {
            toast(err(e, "Could not delete."), "error");
          }
          setConfirm(false);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function TimetableTab({
  t,
  rooms,
  classes,
  subjects,
  save,
}: {
  t: ExamTimetable;
  rooms: ExamRoom[];
  classes: string[];
  subjects: string[];
  save: (patch: { entries: TimetableEntry[] }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const sorted = useMemo(
    () => [...t.entries].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
    [t.entries],
  );
  const days = useMemo(() => {
    const m = new Map<string, TimetableEntry[]>();
    for (const e of sorted) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [sorted]);
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "";

  async function upsert(e: TimetableEntry) {
    const exists = t.entries.some((x) => x.id === e.id);
    const ok = await save({ entries: exists ? t.entries.map((x) => (x.id === e.id ? e : x)) : [...t.entries, e] });
    if (ok) {
      setEditing(null);
      toast("Paper saved.", "success");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t.entries.length} paper(s) over {days.length} day(s)
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              setEditing({
                id: newId(),
                date: sorted[sorted.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
                startTime: "08:00",
                endTime: "10:00",
                subject: "",
                classNames: [],
                roomIds: [],
              })
            }
          >
            <Plus className="me-1.5 h-4 w-4" /> Add paper
          </Button>
          <Button variant="outline" disabled={!t.entries.length} onClick={() => !printTimetable(t, rooms) && toast("Allow pop-ups to print.", "error")}>
            <Printer className="me-1.5 h-4 w-4" /> Print
          </Button>
          <ExportMenu
            disabled={!t.entries.length}
            spec={() => ({
              title: `Exam Timetable — ${t.name}`,
              fileName: `exam-timetable-${t.name}`,
              subtitle: [`Academic Year: ${t.academicYear} · ${t.entries.length} paper(s)`],
              columns: [
                { key: "date", label: "Date" },
                { key: "time", label: "Time" },
                { key: "subject", label: "Subject" },
                { key: "classes", label: "Classes" },
                { key: "rooms", label: "Room(s)" },
                { key: "duration", label: "Duration" },
              ],
              rows: sorted.map((e) => ({
                date: longDate(e.date),
                time: `${e.startTime} – ${e.endTime}`,
                subject: e.subject,
                classes: e.classNames.join(", "),
                rooms: e.roomIds.map(roomName).filter(Boolean).join(", "),
                duration: durationText(e),
              })),
            })}
          />
        </div>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          No papers yet — press <b>Add paper</b> for the first one.
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([day, list]) => (
            <div key={day} className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-2 bg-primary/5 px-4 py-2.5 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" /> {longDate(day)}
              </div>
              <div className="divide-y">
                {list.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="w-32 shrink-0">
                      <p className="font-semibold tabular-nums">{e.startTime} – {e.endTime}</p>
                      <p className="text-xs text-muted-foreground">{durationText(e)}</p>
                    </div>
                    <div className="min-w-[160px] flex-1">
                      <p className="font-semibold">{e.subject}</p>
                      {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                    </div>
                    <div className="flex min-w-[180px] flex-1 flex-wrap gap-1">
                      {e.classNames.map((c) => (
                        <span key={c} className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">{c}</span>
                      ))}
                    </div>
                    <div className="flex min-w-[120px] flex-wrap gap-1">
                      {e.roomIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                          <DoorOpen className="h-3 w-3" /> {roomName(id)}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(e)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 text-rose-600"
                        title="Remove"
                        onClick={async () => {
                          if (await save({ entries: t.entries.filter((x) => x.id !== e.id) })) toast("Paper removed.", "success");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EntryDialog
          entry={editing}
          rooms={rooms}
          classes={classes}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={(e) => void upsert(e)}
        />
      )}
    </div>
  );
}

function EntryDialog({
  entry,
  rooms,
  classes,
  subjects,
  onClose,
  onSave,
}: {
  entry: TimetableEntry;
  rooms: ExamRoom[];
  classes: string[];
  subjects: string[];
  onClose: () => void;
  onSave: (e: TimetableEntry) => void;
}) {
  const [e, setE] = useState(entry);
  const toggle = (k: "classNames" | "roomIds", v: string) =>
    setE((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const valid = e.subject.trim() && e.classNames.length > 0 && e.endTime > e.startTime;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Exam paper"
      description="The subject, the classes that sit it, the day and the time."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSave({ ...e, subject: e.subject.trim() })}>Save paper</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Subject</Label>
          <Input list="tt-subjects" value={e.subject} onChange={(ev) => setE({ ...e, subject: ev.target.value })} placeholder="e.g. Mathematics" />
          <datalist id="tt-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} />
          </div>
          <div>
            <Label>Starts</Label>
            <Input type="time" value={e.startTime} onChange={(ev) => setE({ ...e, startTime: ev.target.value })} />
          </div>
          <div>
            <Label>Ends</Label>
            <Input type="time" value={e.endTime} onChange={(ev) => setE({ ...e, endTime: ev.target.value })} />
          </div>
        </div>
        {e.endTime <= e.startTime && <p className="text-xs text-rose-600">The paper must end after it starts.</p>}
        <div>
          <Label>Classes sitting this paper</Label>
          <ChipPicker options={classes} chosen={e.classNames} toggle={(v) => toggle("classNames", v)} />
        </div>
        <div>
          <Label>Room(s) (optional)</Label>
          {rooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add rooms on the Rooms tab to choose them here.</p>
          ) : (
            <ChipPicker options={rooms.map((r) => r.id)} labels={Object.fromEntries(rooms.map((r) => [r.id, r.name]))} chosen={e.roomIds} toggle={(v) => toggle("roomIds", v)} />
          )}
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Input value={e.note ?? ""} onChange={(ev) => setE({ ...e, note: ev.target.value })} placeholder="e.g. Bring a calculator" />
        </div>
      </div>
    </Dialog>
  );
}

function ChipPicker({
  options,
  chosen,
  toggle,
  labels,
}: {
  options: string[];
  chosen: string[];
  toggle: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = chosen.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm transition",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            {on ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 opacity-50" />}
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function RoomsTab({ rooms, setRooms }: { rooms: ExamRoom[]; setRooms: (fn: (r: ExamRoom[]) => ExamRoom[]) => void }) {
  const blank = { name: "", building: "", rows: 6, cols: 5, notes: "" };
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ExamRoom | null>(null);
  const total = rooms.reduce((n, r) => n + r.rows * r.cols, 0);

  async function submit() {
    const body = { name: form.name.trim(), building: form.building.trim() || null, rows: form.rows, cols: form.cols, notes: form.notes.trim() || null };
    try {
      if (form.id) {
        const r = await apiUpdateRoom(form.id, body);
        setRooms((l) => l.map((x) => (x.id === r.id ? r : x)));
      } else {
        const r = await apiCreateRoom(body);
        setRooms((l) => [...l, r]);
      }
      setOpen(false);
      toast("Room saved.", "success");
    } catch (e) {
      toast(err(e, "Could not save the room."), "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rooms.length} room(s) · <b>{total}</b> seats in all
        </p>
        <Button onClick={() => { setForm(blank); setOpen(true); }}>
          <Plus className="me-1.5 h-4 w-4" /> Add room
        </Button>
      </div>
      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          No rooms yet. Add each exam hall with its rows and columns of desks.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <DoorOpen className="h-4 w-4 text-teal-600" /> {r.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.building ? `${r.building} · ` : ""}{r.rows} rows × {r.cols} columns = <b>{r.rows * r.cols}</b> seats
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm({ id: r.id, name: r.name, building: r.building ?? "", rows: r.rows, cols: r.cols, notes: r.notes ?? "" }); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => setToDelete(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-muted/40 p-2">
                <div className="mb-1 text-center text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">front</div>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${r.cols}, 1fr)` }}>
                  {Array.from({ length: Math.min(r.rows * r.cols, 200) }).map((_, i) => (
                    <div key={i} className="h-2.5 rounded-sm bg-teal-500/30" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit room" : "Add room"}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => void submit()}>Save room</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Room name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hall A" />
            </div>
            <div>
              <Label>Building (optional)</Label>
              <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Rows of desks</Label>
              <Input type="number" min={1} max={40} value={form.rows} onChange={(e) => setForm({ ...form, rows: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} />
            </div>
            <div>
              <Label>Desks per row (columns)</Label>
              <Input type="number" min={1} max={20} value={form.cols} onChange={(e) => setForm({ ...form, cols: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{form.rows * form.cols} seats</p>
        </div>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this room?"
        message={`${toDelete?.name ?? ""} is removed. Seating plans that used it need generating again.`}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await apiDeleteRoom(toDelete.id);
            setRooms((l) => l.filter((x) => x.id !== toDelete.id));
          } catch (e) {
            toast(err(e, "Could not delete."), "error");
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SeatingTab({
  t,
  rooms,
  classes,
  students,
  save,
}: {
  t: ExamTimetable;
  rooms: ExamRoom[];
  classes: string[];
  students: SeatStudentInfo[];
  save: (patch: { seating: ExamTimetable["seating"] }) => Promise<boolean>;
}) {
  const plan = t.seating;
  const [chosenClasses, setChosenClasses] = useState<string[]>(
    plan?.classNames ?? [...new Set(t.entries.flatMap((e) => e.classNames))],
  );
  const [chosenRooms, setChosenRooms] = useState<string[]>(plan?.roomIds ?? rooms.map((r) => r.id));
  const [shuffleIn, setShuffleIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const pool = students.filter((s) => chosenClasses.includes(s.className));
  const roomsChosen = rooms.filter((r) => chosenRooms.includes(r.id));
  const seats = roomsChosen.reduce((n, r) => n + r.rows * r.cols, 0);

  const stats = useMemo(() => {
    if (!plan) return null;
    const cls = (id: string) => byId.get(id)?.className;
    let seated = 0;
    let clashes = 0;
    for (const r of plan.rooms) {
      seated += r.seats.flat().filter(Boolean).length;
      clashes += countClashes(r.seats, cls);
    }
    return { seated, clashes };
  }, [plan, byId]);

  async function generate() {
    if (pool.length === 0) return toast("Choose at least one class with students.", "error");
    if (roomsChosen.length === 0) return toast("Choose at least one room.", "error");
    setBusy(true);
    const res = generateSeating(
      pool.map((s) => ({ id: s.id, className: s.className })),
      roomsChosen.map((r) => ({ id: r.id, rows: r.rows, cols: r.cols })),
      { shuffleWithinClass: shuffleIn, seed: Date.now() % 100000 },
    );
    const ok = await save({
      seating: {
        classNames: chosenClasses,
        roomIds: chosenRooms,
        generatedAt: new Date().toISOString(),
        rooms: res.rooms,
      },
    });
    setBusy(false);
    if (!ok) return;
    if (res.unseated.length) toast(`${res.unseated.length} student(s) did not fit — add a room or seats.`, "error");
    else toast("Mixed seating plan generated.", "success");
  }

  const exportRows = () => {
    if (!plan) return [];
    return plan.rooms.flatMap((pr) => {
      const room = rooms.find((r) => r.id === pr.roomId);
      return pr.seats.flatMap((row, r) =>
        row.map((id, c) => ({ id, seat: seatLabel(r, c) })).filter((x) => x.id && byId.get(x.id)).map((x) => {
          const s = byId.get(x.id!)!;
          return { room: room?.name ?? "", seat: x.seat, code: s.code, name: s.fullName, cls: s.className };
        }),
      );
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Classes to seat together</p>
          <ChipPicker options={classes} chosen={chosenClasses} toggle={(v) => setChosenClasses((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))} />
          <p className="mt-2 text-xs text-muted-foreground">{pool.length} student(s)</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><DoorOpen className="h-4 w-4 text-teal-600" /> Rooms to use</p>
          {rooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add rooms on the Rooms tab first.</p>
          ) : (
            <ChipPicker
              options={rooms.map((r) => r.id)}
              labels={Object.fromEntries(rooms.map((r) => [r.id, `${r.name} (${r.rows * r.cols})`]))}
              chosen={chosenRooms}
              toggle={(v) => setChosenRooms((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))}
            />
          )}
          <p className={cn("mt-2 text-xs", seats < pool.length ? "font-semibold text-rose-600" : "text-muted-foreground")}>
            {seats} seat(s){seats < pool.length ? ` — ${pool.length - seats} short` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void generate()} disabled={busy} className="shadow-sm shadow-primary/30">
          <Shuffle className="me-1.5 h-4 w-4" /> {plan ? "Generate again" : "Generate mixed seating"}
        </Button>
        <label className="ms-1 flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={shuffleIn} onChange={(e) => setShuffleIn(e.target.checked)} /> Shuffle students within each class
        </label>
        {plan && (
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => !printSeatMaps(t, rooms, byId) && toast("Allow pop-ups to print.", "error")}>
              <Printer className="me-1.5 h-4 w-4" /> Seat maps
            </Button>
            <Button variant="outline" onClick={() => !printDoorLists(t, rooms, byId) && toast("Allow pop-ups to print.", "error")}>
              <ListOrdered className="me-1.5 h-4 w-4" /> Room lists
            </Button>
            <ExportMenu
              spec={() => ({
                title: `Seating Plan — ${t.name}`,
                fileName: `seating-${t.name}`,
                columns: [
                  { key: "room", label: "Room" },
                  { key: "seat", label: "Seat" },
                  { key: "code", label: "Student ID" },
                  { key: "name", label: "Student" },
                  { key: "cls", label: "Class" },
                ],
                rows: exportRows(),
              })}
            />
          </div>
        )}
      </div>

      {plan && stats && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            stats.clashes === 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
          )}
        >
          {stats.seated} student(s) seated in {plan.rooms.length} room(s).{" "}
          {stats.clashes === 0
            ? "No two students of the same class sit side by side or one behind the other."
            : `${stats.clashes} pair(s) of same-class neighbours could not be avoided — one class is much larger than the others. Add seats (a room) and generate again to separate them.`}
        </div>
      )}

      {plan &&
        plan.rooms.map((pr) => {
          const room = rooms.find((r) => r.id === pr.roomId);
          if (!room) return null;
          return (
            <div key={pr.roomId} className="rounded-xl border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold"><DoorOpen className="h-4 w-4 text-teal-600" /> {room.name}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {plan.classNames.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colourFor(plan.classNames, c) }} /> {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mb-2 rounded border border-dashed py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Front · Board / Invigilator
              </div>
              <div className="overflow-x-auto">
                <div className="grid min-w-[480px] gap-1.5" style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(84px, 1fr))` }}>
                  {pr.seats.flatMap((row, r) =>
                    row.map((id, c) => {
                      const s = id ? byId.get(id) : undefined;
                      if (!s)
                        return (
                          <div key={`${r}-${c}`} className="relative rounded-lg border border-dashed bg-muted/30 p-1.5 text-[10px] text-muted-foreground">
                            <span className="absolute end-1.5 top-1 font-bold">{seatLabel(r, c)}</span>
                            Empty
                          </div>
                        );
                      const col = colourFor(plan.classNames, s.className);
                      return (
                        <div key={`${r}-${c}`} className="relative rounded-lg border-2 bg-card p-1.5 text-[10.5px] leading-tight" style={{ borderColor: col }}>
                          <span className="absolute end-1.5 top-1 text-[9px] font-bold text-muted-foreground">{seatLabel(r, c)}</span>
                          <p className="truncate pe-5 font-semibold">{s.fullName}</p>
                          <p className="font-mono text-muted-foreground">{s.code}</p>
                          <span className="mt-0.5 inline-block rounded px-1 text-[9px] font-bold text-white" style={{ background: col }}>
                            {s.className}
                          </span>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
