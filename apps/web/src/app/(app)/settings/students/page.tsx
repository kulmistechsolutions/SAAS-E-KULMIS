"use client";


import { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  downloadImportTemplate,
  importTemplateFor,
} from "@/lib/students/import-templates";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import type { StudentFormTemplate } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

export default function StudentSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("students");
  // Switching the form is a visible change to how every future registration
  // looks, so it is confirmed rather than flipped silently. Switching back to
  // STANDARD needs no confirmation — nothing is lost, the extra fields simply
  // stop being asked for.
  const [pendingTemplate, setPendingTemplate] =
    useState<StudentFormTemplate | null>(null);

  function chooseTemplate(next: StudentFormTemplate) {
    if (next === draft.formTemplate) return;
    if (next === "DETAILED") {
      setPendingTemplate(next);
      return;
    }
    update({ formTemplate: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsStudents.studentSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsStudents.studentIdFormatAndPortalAccess")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsStudents.studentIdPrefix")} value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label={t("settingsStudents.startingNumber")} type="number" value={draft.startingNumber} onChange={(e) => update({ startingNumber: Number(e.target.value) })} />
        <SettingsInput label={t("settingsStudents.idLengthPadding")} type="number" value={draft.idLength} onChange={(e) => update({ idLength: Number(e.target.value) })} />
        <div className="flex items-end text-sm text-muted-foreground">
          {t("settingsStudents.example")} {draft.idPrefix}{String(draft.startingNumber).padStart(draft.idLength, "0")}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">
          {t("settingsStudents.registrationForm")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsStudents.registrationFormHelp")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "STANDARD" as const,
                title: t("settingsStudents.standardForm"),
                desc: t("settingsStudents.standardFormDesc"),
              },
              {
                value: "DETAILED" as const,
                title: t("settingsStudents.detailedForm"),
                desc: t("settingsStudents.detailedFormDesc"),
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                draft.formTemplate === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-secondary/40",
              )}
            >
              <input
                type="radio"
                name="studentFormTemplate"
                className="mt-1"
                checked={draft.formTemplate === opt.value}
                onChange={() => chooseTemplate(opt.value)}
              />
              <span>
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {opt.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
        {/* The import layout follows whatever is selected above, so the
            starter file is offered right here rather than only inside the
            import dialog. */}
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => downloadImportTemplate(draft.formTemplate)}
        >
          <Download className="me-2 h-4 w-4" />
          {t("settingsStudents.downloadExcelTemplate")}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("settingsStudents.excelTemplateColumns")}{" "}
          {importTemplateFor(draft.formTemplate).headers.join(", ")}
        </p>
        <div className="mt-4 space-y-2">
          <SettingsToggle
            label={t("settingsStudents.villageRequired")}
            checked={draft.villageRequired}
            onChange={(v) => update({ villageRequired: v })}
          />
          <SettingsToggle
            label={t("settingsStudents.districtRequired")}
            checked={draft.districtRequired}
            onChange={(v) => update({ districtRequired: v })}
          />
        </div>
      </div>

      <SettingsToggle label={t("settingsStudents.allowStudentPortalLogin")} checked={draft.portalLoginEnabled} onChange={(v) => update({ portalLoginEnabled: v })} />
      {draft.portalLoginEnabled && <StudentPortalLinkCard pendingSave={dirty} />}
      <SettingsToggle label={t("settingsStudents.requireStudentPhone")} checked={draft.requirePhone} onChange={(v) => update({ requirePhone: v })} />
      <SettingsToggle label={t("settingsStudents.allowStudentPhotoUpload")} checked={draft.allowPhotoUpload} onChange={(v) => update({ allowPhotoUpload: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsStudents.studentProfileHeaderOptional")} value={draft.studentHeader} onChange={(e) => update({ studentHeader: e.target.value })} />
        <SettingsInput label={t("settingsStudents.studentProfileFooterOptional")} value={draft.studentFooter} onChange={(e) => update({ studentFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />

      <Dialog
        open={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title={t("settingsStudents.switchFormTitle")}
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingTemplate(null)}>
              {t("settingsStudents.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (pendingTemplate) update({ formTemplate: pendingTemplate });
                setPendingTemplate(null);
              }}
            >
              {t("settingsStudents.useDetailedForm")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>{t("settingsStudents.switchFormIntro")}</p>
          <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
            <li>{t("settingsStudents.switchFormFieldPlaceOfBirth")}</li>
            <li>{t("settingsStudents.switchFormFieldDistrict")}</li>
            <li>{t("settingsStudents.switchFormFieldMotherName")}</li>
          </ul>
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400">
            {t("settingsStudents.switchFormDataSafe")}
          </p>
          <p className="text-muted-foreground">
            {t("settingsStudents.switchFormRecordsNote")}
          </p>
          <p className="text-muted-foreground">
            {t("settingsStudents.switchFormImportNote")}
          </p>
          <p className="text-muted-foreground">
            {t("settingsStudents.switchFormReversible")}
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function StudentPortalLinkCard({ pendingSave }: { pendingSave: boolean }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/student-portal/login`);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is still selectable/copyable by hand */
    }
  }

  return (
    <div className="rounded-xl border bg-secondary/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">Student Portal login link</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Share this with students — each one signs in with their own Student ID and
        portal password (their Student ID by default, unless you&apos;ve reset it).
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border bg-background px-3 py-2 text-sm">
          {link}
        </code>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 px-3"
          onClick={() => void copyLink()}
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {pendingSave && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Save your changes above to activate this link for students.
        </p>
      )}
    </div>
  );
}
