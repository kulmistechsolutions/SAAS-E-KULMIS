"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQuiz, teacherCanAssign } from "@/lib/quiz/store";
import { getTeachersState, teacherAssignments } from "@/lib/teachers/store";
import { ACTIVE_ACADEMIC_YEAR, ACADEMIC_YEARS } from "@/lib/students/constants";
import { toast } from "@/lib/toast";

export default function CreateQuizPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const [academicYear, setAcademicYear] = useState<string>(ACTIVE_ACADEMIC_YEAR);
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
    const t = getTeachersState().teachers[0];
    if (t) setTeacherId(t.id);
  }, [mounted]);

  const assignments = useMemo(
    () => (teacherId ? teacherAssignments(teacherId).filter((a) => a.status === "ACTIVE") : []),
    [teacherId],
  );

  const classes = useMemo(() => [...new Set(assignments.map((a) => a.className))], [assignments]);
  const sections = useMemo(
    () => [...new Set(assignments.filter((a) => a.className === className).map((a) => a.section ?? "All"))],
    [assignments, className],
  );
  const subjects = useMemo(
    () => [...new Set(assignments.filter((a) => a.className === className && (a.section === section || a.section === null)).map((a) => a.subject))],
    [assignments, className, section],
  );

  function handleSubmit() {
    if (!teacherCanAssign(teacherId, className, section, subject, academicYear)) {
      toast("Invalid class/section/subject for this teacher", "error");
      return;
    }
    const res = createQuiz({
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
    router.push(`/quiz/${res.quiz!.id}`);
  }

  if (!mounted) return null;

  const teachers = getTeachersState().teachers;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Quiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assign to your class, section, and subject.</p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label>Teacher</Label>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quiz Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={className} onChange={(e) => setClassName(e.target.value)}>
              <option value="">Select</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <Select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Select</option>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Select</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="space-y-2"><Label>Passing Marks</Label><Input type="number" value={passing} onChange={(e) => setPassing(e.target.value)} /></div>
          <div className="space-y-2"><Label>Max Attempts</Label><Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} /></div>
        </div>
        <Button onClick={handleSubmit} className="w-full">Create & Open Builder</Button>
      </div>
    </div>
  );
}
