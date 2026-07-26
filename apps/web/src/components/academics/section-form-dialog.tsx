"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  activeAcademicYear,
  classesForYear,
  createSection,
  updateSection,
} from "@/lib/academics/store";
import type { EntityStatus, Section } from "@/lib/academics/types";

interface Props {
  open: boolean;
  onClose: () => void;
  section?: Section | null;
  /** Pre-selected class when adding from a class profile. */
  defaultClassId?: string;
}

export function SectionFormDialog({
  open,
  onClose,
  section,
  defaultClassId,
}: Props) {
  const t = useT();
  const isEdit = !!section;
  const classes = classesForYear(activeAcademicYear());
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? "");
  const [status, setStatus] = useState<EntityStatus>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (section) {
      setName(section.name);
      setClassId(section.classId);
      setStatus(section.status);
    } else {
      setName("");
      setClassId(defaultClassId ?? classes[0]?.id ?? "");
      setStatus("ACTIVE");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section, defaultClassId]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Section name is required.");
    if (!classId) return setError("Please select a class.");
    const res =
      isEdit && section
        ? await updateSection(section.id, { name, classId, status })
        : await createSection({ name, classId, status });
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast(isEdit ? "Section updated." : "Section created.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Section" : "Add Section"}
      description={t("academicsSectionFormDialog.sectionNamesMustBeUniqueWithin")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("academicsSectionFormDialog.cancel")}
          </Button>
          <Button onClick={submit}>{isEdit ? "Save Changes" : "Create Section"}</Button>
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
          <Label required>{t("academicsSectionFormDialog.sectionName")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("academicsSectionFormDialog.eGA")}
          />
        </div>
        <div>
          <Label required>{t("academicsSectionFormDialog.parentClass")}</Label>
          <Select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={isEdit}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>{t("academicsSectionFormDialog.status")}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)}>
            <option value="ACTIVE">{t("academicsSectionFormDialog.active")}</option>
            <option value="INACTIVE">{t("academicsSectionFormDialog.inactive")}</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
