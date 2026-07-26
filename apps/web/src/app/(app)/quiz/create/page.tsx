"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQuiz, teacherCanAssign } from "@/lib/quiz/store";
import {
  getTeachersState,
  hydrateTeacherSelf,
  teacherAssignedClasses,
  teacherAssignedSections,
  teacherAssignedSubjects,
  teacherAssignments,
} from "@/lib/teachers/store";
import { loadTeacherMe } from "@/lib/teachers/session";
import { classByName, refreshAcademics } from "@/lib/academics/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";

export default function CreateQuizPage() {
  const tr = useT();
  const router = useRouter();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [mounted, setMounted] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const { year: academicYear, setYear: setAcademicYear } =
    useAcademicYearSelect("quiz-create-year");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("30");
  const [passing, setPassing] = useState("10");
  const [maxAttempts, setMaxAttempts] = useState("1");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    if (isTeacher) {
      void loadTeacherMe()
        .then((me) => {
          // A teacher can't load the admin teachers/academics lists, so seed
          // both stores from their own profile: assignments drive the dropdowns
          // and the academics store resolves the class/section/subject IDs.
          hydrateTeacherSelf(me);
          void refreshAcademics();
          setTeacherId(me.id);
        })
        .catch(() => toast("Could not load teacher profile", "error"));
      return;
    }
    const t = getTeachersState().teachers[0];
    if (t) setTeacherId(t.id);
  }, [mounted, isTeacher]);

  const assignments = useMemo(
    () =>
      teacherId
        ? teacherAssignments(teacherId).filter(
            (a) =>
              a.status === "ACTIVE" &&
              (!academicYear || a.academicYear === academicYear),
          )
        : [],
    [teacherId, academicYear],
  );

  const classes = useMemo(
    () => teacherAssignedClasses(teacherId, academicYear || undefined),
    [teacherId, academicYear, assignments],
  );
  const selectedClass = useMemo(
    () => (className ? classByName(className, academicYear || undefined) : undefined),
    [className, academicYear],
  );
  const classNeedsSection = selectedClass?.hasSections ?? true;
  const sections = useMemo(
    () =>
      className
        ? teacherAssignedSections(
            teacherId,
            className,
            academicYear || undefined,
          )
        : [],
    [teacherId, className, academicYear, assignments],
  );
  const subjects = useMemo(
    () =>
      className
        ? teacherAssignedSubjects(
            teacherId,
            className,
            section || undefined,
            academicYear || undefined,
          )
        : [],
    [teacherId, className, section, academicYear, assignments],
  );

  useEffect(() => {
    if (className && !classes.includes(className)) {
      setClassName("");
      setSection("");
      setSubject("");
    }
  }, [classes, className]);

  useEffect(() => {
    if (section && !sections.includes(section)) {
      setSection("");
      setSubject("");
    }
  }, [sections, section]);

  useEffect(() => {
    if (subject && !subjects.includes(subject)) setSubject("");
  }, [subjects, subject]);

  async function handleSubmit() {
    if (classNeedsSection && (!section || section === "All")) {
      toast("Select a specific section before creating a quiz", "error");
      return;
    }
    if (!subject) {
      toast("Select a subject for this quiz", "error");
      return;
    }
    if (
      !teacherCanAssign(
        teacherId,
        className,
        section,
        subject,
        academicYear,
      )
    ) {
      toast("Invalid class/section/subject for this teacher", "error");
      return;
    }
    const res = await createQuiz({
      title,
      academicYear,
      className,
      section,
      subject,
      description,
      teacherId,
      startDate,
      endDate,
      durationMinutes: Number(duration),
      passingMarks: Number(passing),
      maxAttempts: Number(maxAttempts),
      status: "DRAFT",
    });
    if (!res.ok) {
      toast(res.error ?? "Failed", "error");
      return;
    }
    toast(`Quiz ${res.quiz?.code} created`, "success");
    router.push(
      isTeacher ? `/teacher-portal/quizzes/${res.quiz!.id}` : `/quiz/${res.quiz!.id}`,
    );
  }

  if (!mounted) return null;

  const teachers = getTeachersState().teachers;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("quizCreate.createQuiz")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("quizCreate.classSectionAndSubjectOptionsCome")}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        {!isTeacher && (
          <div className="space-y-2">
            <Label>{tr("quizCreate.teacher")}</Label>
            <Select
              value={teacherId}
              onChange={(e) => {
                setTeacherId(e.target.value);
                setClassName("");
                setSection("");
                setSubject("");
              }}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>{tr("quizCreate.quizTitle")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{tr("quizCreate.academicYear")}</Label>
            <AcademicYearSelect
              value={academicYear}
              onChange={(y) => {
                setAcademicYear(y);
                setClassName("");
                setSection("");
                setSubject("");
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.class")}</Label>
            <Select
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSection("");
                setSubject("");
              }}
            >
              <option value="">{tr("quizCreate.select")}</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.section")}</Label>
            <Select
              value={section}
              disabled={!classNeedsSection || sections.length === 0}
              onChange={(e) => {
                setSection(e.target.value);
                setSubject("");
              }}
            >
              <option value="">{classNeedsSection ? "Select" : "—"}</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.subject")}</Label>
            <Select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">{tr("quizCreate.select")}</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!assignments.length && teacherId ? (
          <p className="text-sm text-amber-600">
            {tr("quizCreate.thisTeacherHasNoAssignmentsFor")}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label>{tr("quizCreate.description")}</Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{tr("quizCreate.startDate")}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.endDate")}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.durationMin")}</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.passingMarks")}</Label>
            <Input
              type="number"
              value={passing}
              onChange={(e) => setPassing(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("quizCreate.maxAttempts")}</Label>
            <Input
              type="number"
              min={1}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => void handleSubmit()} className="w-full">
          {tr("quizCreate.createOpenBuilder")}
        </Button>
      </div>
    </div>
  );
}
