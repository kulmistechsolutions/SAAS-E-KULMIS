"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  apiClassResetPreview,
  apiResetClass,
  apiResetSchool,
  apiSchoolResetPreview,
  type ApiClassResetPreview,
  type ApiSchoolResetPreview,
} from "@/lib/students/api";
import {
  ensureAcademicsLoaded,
  getAcademicsState,
  useAcademicsState,
} from "@/lib/academics/store";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import { toast } from "@/lib/toast";

export default function DangerZonePage() {
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
        <h1 className="text-2xl font-bold">Danger Zone</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deliberate resets. Normal deletes keep student IDs retired forever —
          only these restart numbering. Everything here is permanent and cannot
          be undone.
        </p>
      </div>

      <ClassResetCard />
      <SchoolResetCard />
    </div>
  );
}

/** Reset a single class — delete its students, keep the class for re-import. */
function ClassResetCard() {
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
        Reset one class
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Erase every student in a class (and their history) but keep the class,
        so you can re-import it cleanly. Student IDs stay retired — the
        school&apos;s numbering does not restart. Parents left with no children
        anywhere are removed.
      </p>

      <div className="mt-4 max-w-md space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Class</label>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class…</option>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Counting…
          </p>
        ) : preview ? (
          <>
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p>
                <span className="font-bold">{preview.counts.students}</span>{" "}
                students and{" "}
                <span className="font-bold">{preview.counts.parents}</span>{" "}
                parents will be deleted.
              </p>
              {preview.counts.parentsKept > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.counts.parentsKept} parent
                  {preview.counts.parentsKept === 1 ? "" : "s"} kept — they have
                  children in other classes.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Type <span className="font-mono">{preview.name}</span> to
                confirm
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
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
        Reset the whole school
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Delete <strong>every</strong> student and parent in the school and
        restart student numbering from #1. Classes, teachers, subjects and
        settings are kept. Use this only for a fresh start.
      </p>

      {!open ? (
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => void loadPreview()}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Reset entire school…
        </Button>
      ) : preview ? (
        <div className="mt-4 max-w-md space-y-3">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p>
              This deletes{" "}
              <span className="font-bold">{preview.counts.students}</span>{" "}
              students and{" "}
              <span className="font-bold">{preview.counts.parents}</span>{" "}
              parents. Numbering restarts at 1.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Type the school name{" "}
              <span className="font-mono">{preview.name}</span> to confirm
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void handleReset()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
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
