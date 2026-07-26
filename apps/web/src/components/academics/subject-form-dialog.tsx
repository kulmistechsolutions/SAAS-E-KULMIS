"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { createSubject, updateSubject } from "@/lib/academics/store";
import type { EntityStatus, Subject } from "@/lib/academics/types";

interface Props {
  open: boolean;
  onClose: () => void;
  subject?: Subject | null;
}

export function SubjectFormDialog({ open, onClose, subject }: Props) {
  const t = useT();
  const isEdit = !!subject;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<EntityStatus>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (subject) {
      setName(subject.name);
      setCode(subject.code ?? "");
      setStatus(subject.status);
    } else {
      setName("");
      setCode("");
      setStatus("ACTIVE");
    }
  }, [open, subject]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Subject name is required.");
    const res =
      isEdit && subject
        ? await updateSubject(subject.id, { name, code, status })
        : await createSubject({ name, code, status });
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast(isEdit ? "Subject updated." : "Subject created.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Subject" : "Add Subject"}
      description={t("academicsSubjectFormDialog.subjectNamesMustBeUniqueAcross")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("academicsSubjectFormDialog.cancel")}
          </Button>
          <Button onClick={submit}>{isEdit ? "Save Changes" : "Create Subject"}</Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <div>
          <Label required>{t("academicsSubjectFormDialog.subjectName")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("academicsSubjectFormDialog.eGMathematics")}
          />
        </div>
        <div>
          <Label>{t("academicsSubjectFormDialog.subjectCode")}</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("academicsSubjectFormDialog.eGMat")}
          />
        </div>
        <div>
          <Label required>{t("academicsSubjectFormDialog.status")}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)}>
            <option value="ACTIVE">{t("academicsSubjectFormDialog.active")}</option>
            <option value="INACTIVE">{t("academicsSubjectFormDialog.inactive")}</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
