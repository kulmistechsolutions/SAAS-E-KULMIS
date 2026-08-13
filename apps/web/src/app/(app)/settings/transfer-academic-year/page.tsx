"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  apiAcademicYearTransferPreview,
  apiExecuteAcademicYearTransfer,
  type ApiAcademicYearTransferPreview,
} from "@/lib/students/api";
import {
  ensureAcademicsLoaded,
  useAcademicsState,
} from "@/lib/academics/store";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import { toast } from "@/lib/toast";

export default function TransferAcademicYearPage() {
  const t = useT();
  const router = useRouter();
  const isSuper = useIsSchoolSuperAdmin();
  const academics = useAcademicsState();

  const [fromYearId, setFromYearId] = useState("");
  const [toYearId, setToYearId] = useState("");
  const [preview, setPreview] = useState<ApiAcademicYearTransferPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSuper) router.replace("/settings");
  }, [isSuper, router]);
  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  if (!isSuper) return null;

  const years = academics.academicYears;

  async function loadPreview() {
    if (!fromYearId || !toYearId) return;
    if (fromYearId === toYearId) {
      toast(t("settingsTransferAcademicYear.sameYearError"), "error");
      return;
    }
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await apiAcademicYearTransferPreview(fromYearId, toYearId);
      setPreview(res);
      setConfirmOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settingsTransferAcademicYear.couldNotLoadPreview"), "error");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTransfer() {
    if (!fromYearId || !toYearId) return;
    setBusy(true);
    try {
      const res = await apiExecuteAcademicYearTransfer(fromYearId, toYearId);
      toast(
        `${res.transferred} ${t("settingsTransferAcademicYear.studentsMovedFrom")} ${res.fromYear} ${t("settingsTransferAcademicYear.to")} ${res.toYear}` +
          (res.skipped > 0
            ? ` — ${res.skipped} ${t("settingsTransferAcademicYear.skippedNoMatchingClass")}`
            : ""),
        res.skipped > 0 ? "info" : "success",
      );
      setConfirmOpen(false);
      setPreview(null);
      setFromYearId("");
      setToYearId("");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settingsTransferAcademicYear.transferFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsTransferAcademicYear.transferAcademicYear")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("settingsTransferAcademicYear.pageDescription")}
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h2 className="flex items-center gap-2 font-semibold">
          <ArrowLeftRight className="h-4 w-4 text-amber-600" />
          {t("settingsTransferAcademicYear.moveStudents")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsTransferAcademicYear.cardDescription")}
        </p>

        <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settingsTransferAcademicYear.fromYear")}
            </label>
            <Select
              value={fromYearId}
              onChange={(e) => {
                setFromYearId(e.target.value);
                setPreview(null);
                setConfirmOpen(false);
              }}
            >
              <option value="">{t("settingsTransferAcademicYear.selectYear")}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settingsTransferAcademicYear.toYear")}
            </label>
            <Select
              value={toYearId}
              onChange={(e) => {
                setToYearId(e.target.value);
                setPreview(null);
                setConfirmOpen(false);
              }}
            >
              <option value="">{t("settingsTransferAcademicYear.selectYear")}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Button
          className="mt-4"
          disabled={!fromYearId || !toYearId || loadingPreview}
          onClick={() => void loadPreview()}
        >
          {loadingPreview ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("settingsTransferAcademicYear.checking")}
            </>
          ) : (
            t("settingsTransferAcademicYear.reviewTransfer")
          )}
        </Button>

        {confirmOpen && preview && (
          <div className="mt-4 max-w-xl space-y-3 rounded-lg border bg-card p-4">
            <p className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("settingsTransferAcademicYear.warningMessage")}
            </p>
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
              <p>
                <span className="font-bold">{preview.transferable}</span>{" "}
                {t("settingsTransferAcademicYear.studentsWillMoveFrom")}{" "}
                <span className="font-semibold">{preview.fromYear}</span>{" "}
                {t("settingsTransferAcademicYear.to")}{" "}
                <span className="font-semibold">{preview.toYear}</span>.
              </p>
              {preview.unmatched > 0 && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {preview.unmatched}{" "}
                  {t("settingsTransferAcademicYear.studentsWontMoveNoMatch")}
                  {preview.unmatchedClasses.length > 0
                    ? `: ${preview.unmatchedClasses.map((c) => `${c.name} (${c.studentCount})`).join(", ")}`
                    : ""}
                </p>
              )}
              {preview.classes.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {preview.classes.map((c) => (
                    <li key={c.name}>
                      {c.name} — {c.studentCount}{" "}
                      {c.matched
                        ? t("settingsTransferAcademicYear.willMove")
                        : t("settingsTransferAcademicYear.noMatchingClass")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  setPreview(null);
                }}
              >
                {t("settingsDangerZone.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={busy || preview.transferable === 0}
                onClick={() => void handleTransfer()}
              >
                {busy ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("settingsTransferAcademicYear.transferring")}
                  </>
                ) : (
                  `${t("settingsTransferAcademicYear.confirmTransfer")} ${preview.transferable} ${t("settingsTransferAcademicYear.students")}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
