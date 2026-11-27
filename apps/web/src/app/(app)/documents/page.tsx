"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Briefcase,
  ChevronRight,
  CreditCard,
  FileText,
  FileType2,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  Printer,
  Search,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuth } from "@/lib/auth";
import { useStudentsState, withParents } from "@/lib/students/store";
import { refreshTeachers, useTeachersState } from "@/lib/teachers/store";
import { ensureEmployeesLoaded, useEmployeesState } from "@/lib/employees/store";
import { designFor } from "@/lib/print/design-store";
import { StudentDocumentsMenu, STUDENT_DOCS } from "@/components/students/student-documents-menu";
import { DOC_TITLES, type DocDesign, type StudentDocKind } from "@/lib/documents/student-docs";
import {
  PERSON_DOC_TITLES,
  personDocumentHtml,
  type DocSubject,
  type PersonDocKind,
} from "@/lib/documents/people-docs";
import { wordFromPrintHtml } from "@/lib/documents/word";
import { exportHtmlToWord, type ExportSpec } from "@/lib/export/table-export";
import { ExportMenu } from "@/components/export/export-menu";

type Who = "students" | "teachers" | "staff" | "parents";

const TABS: { id: Who; label: string; icon: LucideIcon; tone: string }[] = [
  { id: "students", label: "Students", icon: GraduationCap, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { id: "teachers", label: "Teachers", icon: UserRound, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { id: "staff", label: "Staff", icon: Briefcase, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { id: "parents", label: "Parents", icon: HeartHandshake, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
];

const PERSON_DOCS: Record<Exclude<Who, "students">, { kind: PersonDocKind; hint: string }[]> = {
  teachers: [
    { kind: "APPOINTMENT", hint: "Warqadda shaqo-qorista" },
    { kind: "TEACHER_SERVICE", hint: "Confirms the years of service" },
    { kind: "TEACHER_INFO", hint: "Everything on the teacher's record" },
  ],
  staff: [
    { kind: "EMPLOYMENT", hint: "Confirms the person works here" },
    { kind: "STAFF_INFO", hint: "Everything on the staff record" },
  ],
  parents: [{ kind: "PARENT_INFO", hint: "The guardian and their children" }],
};

interface Person {
  id: string;
  code: string;
  name: string;
  sub: string;
}

/**
 * Documents Center — every document the school hands out, in one place.
 *
 * Pick who it is for (a student, teacher, staff member or parent), pick the
 * person, pick the document; it opens in a preview to print, save as PDF or
 * download as Word. Certificates and ID cards are one click away. Each of
 * these is still on its own page too — this is the place that gathers them.
 */
export default function DocumentsCenterPage() {
  const mounted = useHydrated();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const studentsState = useStudentsState();
  const teachersState = useTeachersState();
  const employeesState = useEmployeesState();

  const [who, setWho] = useState<Who>("students");
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState("");
  const [studentDoc, setStudentDoc] = useState<StudentDocKind | null>(null);
  const [personDoc, setPersonDoc] = useState<PersonDocKind | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    void refreshTeachers();
    void ensureEmployeesLoaded();
  }, [mounted]);

  useEffect(() => {
    setPersonId("");
    setSearch("");
  }, [who]);

  const students = useMemo(() => (mounted ? withParents(studentsState) : []), [mounted, studentsState]);

  const people: Person[] = useMemo(() => {
    if (who === "students")
      return students.map((s) => ({ id: s.id, code: s.code, name: s.fullName, sub: [s.className, s.section].filter(Boolean).join(" - ") }));
    if (who === "teachers")
      return teachersState.teachers.map((t) => ({ id: t.id, code: t.code, name: t.fullName, sub: t.phone ?? "" }));
    if (who === "staff")
      return employeesState.employees.map((e) => ({ id: e.id, code: e.code, name: e.fullName, sub: e.position }));
    return studentsState.parents.map((p) => ({ id: p.id, code: p.code, name: p.name, sub: p.phone ?? "" }));
  }, [who, students, teachersState.teachers, employeesState.employees, studentsState.parents]);

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? people.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      : people;
    return list.slice(0, 40);
  }, [people, search]);

  const person = people.find((p) => p.id === personId) ?? null;
  const student = who === "students" ? students.find((s) => s.id === personId) ?? null : null;

  const subject: DocSubject | null = useMemo(() => {
    if (!personId) return null;
    if (who === "teachers") {
      const t = teachersState.teachers.find((x) => x.id === personId);
      if (!t) return null;
      const classes = [
        ...new Set(
          (teachersState.assignments ?? [])
            .filter((a) => a.teacherId === t.id && a.status === "ACTIVE")
            .map((a) => [a.className, a.section].filter(Boolean).join(" - ")),
        ),
      ];
      return { type: "TEACHER", teacher: t, classes };
    }
    if (who === "staff") {
      const e = employeesState.employees.find((x) => x.id === personId);
      return e ? { type: "STAFF", staff: e } : null;
    }
    if (who === "parents") {
      const p = studentsState.parents.find((x) => x.id === personId);
      return p ? { type: "PARENT", parent: p, children: students.filter((s) => s.parentId === p.id) } : null;
    }
    return null;
  }, [who, personId, teachersState, employeesState.employees, studentsState.parents, students]);

  const personHtml = useMemo(() => {
    if (!subject || !personDoc) return "";
    const design = designFor(subject.type === "PARENT" ? "PARENT_PROFILE" : "TEACHER_PROFILE");
    return personDocumentHtml(subject, {
      kind: personDoc,
      design: design.template as DocDesign,
      paper: design.paper ?? "A4",
      landscape: design.landscape ?? false,
      showLogo: true,
      showStamp: true,
      showContact: true,
      showSalary: false,
    });
  }, [subject, personDoc]);

  function printPerson() {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return toast("Allow pop-ups to print.", "error");
    w.document.write(personHtml);
    w.document.close();
    w.focus();
    w.onload = () => w.print();
  }

  async function wordPerson() {
    if (!personDoc || !person) return;
    setBusy(true);
    try {
      const title = PERSON_DOC_TITLES[personDoc];
      await exportHtmlToWord(
        wordFromPrintHtml(personHtml, { title }),
        `${title}-${person.code}`.replace(/\s+/g, "-").toLowerCase(),
      );
      toast("Word document downloaded.", "success");
    } catch {
      toast("The Word file could not be created.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  const docs =
    who === "students"
      ? STUDENT_DOCS.map((d) => ({ key: d.kind, title: DOC_TITLES[d.kind], hint: d.hint, icon: d.icon, tone: d.tone }))
      : PERSON_DOCS[who].map((d) => ({
          key: d.kind,
          title: PERSON_DOC_TITLES[d.kind],
          hint: d.hint,
          icon: FileText,
          tone: TABS.find((t) => t.id === who)!.tone,
        }));

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-72 rounded-b-[3rem] bg-gradient-to-br from-sky-200/50 via-indigo-100/30 to-transparent dark:from-sky-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />

      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30">
          <FolderOpen className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Documents Center</h1>
          <p className="text-sm text-muted-foreground">
            Every letter, certificate and card the school issues — for students, teachers, staff and parents.
          </p>
        </div>
      </div>

      {/* ── Certificates & cards ── */}
      {!isTeacher && (
        <div className="relative grid gap-3 sm:grid-cols-2">
          <QuickLink href="/certificates" icon={Award} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Graduation Certificates" desc="Design and print for one student or a whole class" />
          <QuickLink href="/id-cards" icon={CreditCard} tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" title="ID Cards" desc="Student, exam and staff cards" />
        </div>
      )}

      <div className="relative rounded-2xl border bg-card shadow-sm">
        {/* who */}
        <div className="flex flex-wrap items-center gap-1 border-b px-3 pt-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = who === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setWho(t.id)}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
          <div className="ms-auto pb-2">
            <ExportMenu
              className="[&>button]:h-9"
              disabled={people.length === 0}
              spec={() => {
                const q = search.trim().toLowerCase();
                return peopleExportSpec(
                  who,
                  q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) : people,
                );
              }}
            />
          </div>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[340px_1fr] sm:p-5">
          {/* person picker */}
          <div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder={`Search ${TABS.find((t) => t.id === who)!.label.toLowerCase()} by name or ID…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ul className="max-h-[420px] overflow-y-auto rounded-xl border scrollbar-slim">
              {hits.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nobody found.</li>
              )}
              {hits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPersonId(p.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b px-3 py-2 text-start text-sm last:border-b-0 hover:bg-muted",
                      personId === p.id && "bg-primary/5",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.code}{p.sub ? ` · ${p.sub}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {people.length > hits.length && (
              <p className="mt-1.5 text-xs text-muted-foreground">Showing {hits.length} of {people.length} — search to narrow.</p>
            )}
          </div>

          {/* documents */}
          <div>
            {!person ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                <Users className="mb-2 h-8 w-8 opacity-40" />
                Choose a person on the left to see their documents.
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm">
                  Documents for <strong>{person.name}</strong>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{person.code}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {docs.map((d) => {
                    const Icon = d.icon;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          who === "students" ? setStudentDoc(d.key as StudentDocKind) : setPersonDoc(d.key as PersonDocKind)
                        }
                        className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      >
                        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", d.tone)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{d.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{d.hint}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180" />
                      </button>
                    );
                  })}
                  {who === "students" && (
                    <Link
                      href="/certificates"
                      className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Award className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">Graduation Certificate</span>
                        <span className="block truncate text-xs text-muted-foreground">Opens the certificate designer</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Student documents reuse the student page's own window. */}
      {student && studentDoc && (
        <StudentDocumentsMenu
          key={`${student.id}-${studentDoc}`}
          student={student}
          canEdit={!isTeacher}
          initialKind={studentDoc}
          hideButton
          onClosed={() => setStudentDoc(null)}
        />
      )}

      <Dialog
        open={!!personDoc && !!subject}
        onClose={() => setPersonDoc(null)}
        title={personDoc && person ? `${PERSON_DOC_TITLES[personDoc]} — ${person.name}` : ""}
        description="Check the preview, then print (or save as PDF) or download as Word."
        className="max-w-4xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPersonDoc(null)}>Close</Button>
            <Button variant="outline" onClick={() => void wordPerson()} disabled={busy}>
              <FileType2 className="me-2 h-4 w-4 text-blue-600" /> {busy ? "Preparing…" : "Download Word"}
            </Button>
            <Button onClick={printPerson}>
              <Printer className="me-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        }
      >
        <iframe title="Document preview" srcDoc={personHtml} className="h-[65vh] w-full rounded-lg border bg-white" />
      </Dialog>
    </div>
  );
}

/** The people on the current tab, as a table to export. */
function peopleExportSpec(who: Who, list: Person[]): ExportSpec {
  const label = TABS.find((t) => t.id === who)!.label;
  const sub =
    who === "students" ? "Class" : who === "staff" ? "Position" : "Phone";
  return {
    title: `${label} — Documents Center`,
    fileName: `${label.toLowerCase()}-list`,
    subtitle: [`${list.length} ${label.toLowerCase()}`],
    columns: [
      { key: "code", label: "ID" },
      { key: "name", label: "Name" },
      { key: "sub", label: sub },
    ],
    rows: list.map((p) => ({ code: p.code, name: p.name, sub: p.sub })),
  };
}

function QuickLink({
  href,
  icon: Icon,
  tone,
  title,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180" />
    </Link>
  );
}
