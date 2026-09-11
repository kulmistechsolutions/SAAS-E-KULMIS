"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  FileText,
  GraduationCap,
  Printer,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuth } from "@/lib/auth";
import {
  refreshStudents,
  useStudentsState,
  withParents,
} from "@/lib/students/store";
import { refreshTeachers, useTeachersState } from "@/lib/teachers/store";
import { refreshEmployees, useEmployeesState } from "@/lib/employees/store";
import { PaperPicker } from "@/components/print/paper-picker";
import { TeachersTabs } from "@/components/teachers/teachers-tabs";
import type { PaperSize } from "@/lib/print/paper";
import { DESIGNS, type DocDesign } from "@/lib/documents/doc-shell";
import {
  PERSON_DOC_TITLES,
  personDocumentHtml,
  printPersonDocument,
  type DocSubject,
  type PersonDocKind,
  type PersonDocOptions,
} from "@/lib/documents/people-docs";

/**
 * The Document Center, for the people who are not students.
 *
 * Same engine, same letterhead, same four designs — a school's teacher letter
 * and its student letter should be recognisably from the same school.
 *
 * Read-only: nothing here writes to a teacher, guardian or staff record. The
 * one field that is not safe for every reader is pay, and it is off by default
 * and hidden outright from anyone whose role cannot see salaries, rather than
 * left as a box a clerk has to remember to untick.
 */

const KINDS: {
  id: PersonDocKind;
  group: "TEACHER" | "PARENT" | "STAFF";
  label: string;
  icon: typeof FileText;
  note: string;
}[] = [
  {
    id: "TEACHER_INFO",
    group: "TEACHER",
    label: "Teacher Information",
    icon: GraduationCap,
    note: "Everything on record.",
  },
  {
    id: "APPOINTMENT",
    group: "TEACHER",
    label: "Appointment Letter",
    icon: FileText,
    note: "Confirms a teaching post.",
  },
  {
    id: "TEACHER_SERVICE",
    group: "TEACHER",
    label: "Service Certificate",
    icon: BadgeCheck,
    note: "Certifies years served.",
  },
  {
    id: "PARENT_INFO",
    group: "PARENT",
    label: "Parent Information",
    icon: UsersRound,
    note: "Guardian and their children.",
  },
  {
    id: "STAFF_INFO",
    group: "STAFF",
    label: "Staff Information",
    icon: Briefcase,
    note: "Non-teaching staff record.",
  },
  {
    id: "EMPLOYMENT",
    group: "STAFF",
    label: "Employment Letter",
    icon: FileText,
    note: "Confirms a staff post.",
  },
];

/** Roles that may see what a person is paid. */
const MAY_SEE_PAY = ["SUPER_ADMINISTRATOR", "ADMINISTRATOR", "FINANCE_OFFICER"];

export default function StaffDocumentsPage() {
  const hydrated = useHydrated();
  const { user } = useAuth();
  const teachersState = useTeachersState();
  const employeesState = useEmployeesState();
  const studentsState = useStudentsState();

  const [kind, setKind] = useState<PersonDocKind>("TEACHER_INFO");
  const [design, setDesign] = useState<DocDesign>("MODERN");
  const [personId, setPersonId] = useState("");
  const [q, setQ] = useState("");
  const [paper, setPaper] = useState<PaperSize>();
  const [landscape, setLandscape] = useState(false);
  const [reference, setReference] = useState("");

  const [showLogo, setShowLogo] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showSalary, setShowSalary] = useState(false);

  useEffect(() => {
    void refreshTeachers();
    void refreshEmployees();
    void refreshStudents();
  }, []);

  // Hidden outright, not merely defaulted off: a control a clerk can tick is
  // a salary on a letter waiting to happen.
  const maySeePay = MAY_SEE_PAY.includes(user?.role ?? "");

  const group = KINDS.find((k) => k.id === kind)?.group ?? "TEACHER";

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (name: string, code: string) =>
      !needle ||
      name.toLowerCase().includes(needle) ||
      code.toLowerCase().includes(needle);

    if (group === "TEACHER") {
      return teachersState.teachers
        .filter((t) => match(t.fullName, t.code))
        .map((t) => ({ id: t.id, label: `${t.fullName} — ${t.code}` }));
    }
    if (group === "STAFF") {
      return employeesState.employees
        .filter((e) => match(e.fullName, e.code))
        .map((e) => ({ id: e.id, label: `${e.fullName} — ${e.code} — ${e.position}` }));
    }
    return studentsState.parents
      .filter((p) => match(p.name, p.code))
      .map((p) => ({ id: p.id, label: `${p.name} — ${p.code}` }));
  }, [group, q, teachersState, employeesState, studentsState]);

  // A person from the previous group is not on the new list, so the selection
  // follows the group rather than silently pointing at nobody.
  useEffect(() => {
    if (!people.some((p) => p.id === personId)) {
      setPersonId(people[0]?.id ?? "");
    }
  }, [people, personId]);

  const subject: DocSubject | null = useMemo(() => {
    if (!personId) return null;
    if (group === "TEACHER") {
      const t = teachersState.teachers.find((x) => x.id === personId);
      if (!t) return null;
      const classes = [
        ...new Set(
          teachersState.assignments
            .filter((a) => a.teacherId === t.id && a.status === "ACTIVE")
            .map((a) => [a.className, a.section].filter(Boolean).join(" - ")),
        ),
      ];
      return { type: "TEACHER", teacher: t, classes };
    }
    if (group === "STAFF") {
      const e = employeesState.employees.find((x) => x.id === personId);
      return e ? { type: "STAFF", staff: e } : null;
    }
    const p = studentsState.parents.find((x) => x.id === personId);
    if (!p) return null;
    const children = withParents(studentsState).filter(
      (s) => s.parentId === p.id && s.status === "ACTIVE",
    );
    return { type: "PARENT", parent: p, children };
  }, [group, personId, teachersState, employeesState, studentsState]);

  const options: PersonDocOptions = {
    kind,
    design,
    paper: paper ?? "A4",
    landscape,
    showLogo,
    showStamp,
    showContact,
    showSalary: maySeePay && showSalary,
    reference: reference.trim() || undefined,
  };

  const html = useMemo(
    () => (subject ? personDocumentHtml(subject, options) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject, kind, design, paper, landscape, showLogo, showStamp, showContact,
     showSalary, maySeePay, reference],
  );

  if (!hydrated) return null;

  const isLetter =
    kind === "APPOINTMENT" || kind === "TEACHER_SERVICE" || kind === "EMPLOYMENT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Printer className="h-6 w-6 text-primary" />
            Staff &amp; Parent Documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Teacher, guardian and staff paperwork. Nothing here changes a record.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void refreshTeachers();
            void refreshEmployees();
            void refreshStudents();
          }}
        >
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <TeachersTabs />

      <div className="grid items-start gap-4 xl:grid-cols-[320px,minmax(0,1fr),260px]">
        <div className="space-y-4">
          <Panel n={1} title="Select Document Type">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`rounded-xl border p-3 text-start transition-colors ${
                    kind === k.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                  }`}
                >
                  <k.icon
                    className={`h-5 w-5 ${kind === k.id ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <p className="mt-1.5 text-xs font-semibold leading-tight">{k.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{k.note}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel n={2} title="Select Person">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or ID"
                className="ps-9"
              />
            </div>
            <Select
              className="mt-2"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {people.length === 0 && <option value="">No match</option>}
              {people.slice(0, 100).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Panel>

          <Panel n={3} title="Document Options">
            <div className="space-y-3">
              <div>
                <Label>Design</Label>
                <Select
                  className="mt-1"
                  value={design}
                  onChange={(e) => setDesign(e.target.value as DocDesign)}
                >
                  {DESIGNS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PaperPicker value={paper} onChange={setPaper} />
                <div>
                  <Label>Orientation</Label>
                  <Select
                    className="mt-1"
                    value={landscape ? "L" : "P"}
                    onChange={(e) => setLandscape(e.target.value === "L")}
                  >
                    <option value="P">Portrait</option>
                    <option value="L">Landscape</option>
                  </Select>
                </div>
              </div>
              {isLetter && (
                <div>
                  <Label>Reference number (optional)</Label>
                  <Input
                    className="mt-1"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="LTR-2026-000001"
                  />
                </div>
              )}

              <div className="space-y-1 border-t pt-3">
                <Toggle label="Show school logo" checked={showLogo} onChange={setShowLogo} />
                <Toggle label="Show school stamp" checked={showStamp} onChange={setShowStamp} />
                <Toggle
                  label="Include contact details"
                  checked={showContact}
                  onChange={setShowContact}
                />
                {maySeePay && (
                  <Toggle
                    label="Include salary"
                    checked={showSalary}
                    onChange={setShowSalary}
                  />
                )}
              </div>
              {!maySeePay && (
                <p className="text-xs text-muted-foreground">
                  Salary is not included — your role cannot print pay figures.
                </p>
              )}
            </div>
          </Panel>

          <Panel n={4} title="Actions">
            <Button
              className="w-full"
              onClick={() => subject && printPersonDocument(subject, options)}
              disabled={!subject}
            >
              <Printer className="me-2 h-4 w-4" />
              Print {PERSON_DOC_TITLES[kind]}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Choose &ldquo;Save as PDF&rdquo; in the print dialog to download.
            </p>
          </Panel>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Document Preview</h2>
            <span className="text-xs text-muted-foreground">
              {options.paper} · {landscape ? "Landscape" : "Portrait"}
            </span>
          </div>
          {subject ? (
            <iframe
              title="Document preview"
              srcDoc={html}
              className="h-[820px] w-full rounded-xl border bg-white"
            />
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Choose a person to see the document.
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Document Templates</h2>
          <div className="mt-3 space-y-2">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDesign(d.id)}
                className={`w-full rounded-xl border p-3 text-start transition-colors ${
                  design === d.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                }`}
              >
                <p className="text-sm font-medium">{d.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {n}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
