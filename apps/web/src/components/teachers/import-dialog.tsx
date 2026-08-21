"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Download, FileUp, Upload, ArrowLeft, Eye } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { csvToObjects, headersMatch } from "@/lib/csv";
import {
  bulkImport,
  previewTeacherImport,
  type ImportResult,
  type ImportRow,
  type TeacherImportPreviewRow,
} from "@/lib/teachers/store";
import { useShifts } from "@/lib/teachers/shifts";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: (result: ImportResult) => void;
}

const HEADERS = ["Full Name", "Gender", "Phone", "Salary", "Shift"];
const COLUMNS: (keyof ImportRow)[] = [
  "fullName",
  "gender",
  "phone",
  "salary",
  "shift",
];

function buildTemplate(shiftNames: string[]): string {
  const [a, b] = shiftNames.length ? shiftNames : ["Morning", "Afternoon"];
  return `${HEADERS.join(",")}
Ahmed Hassan,MALE,+252611100001,500,${a}
Fatima Ali,FEMALE,+252611100002,480,${b ?? a}`;
}

type Step = "upload" | "preview" | "result";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function parseTeacherCsv(text: string): { rows: ImportRow[]; error?: string } {
  const { headers, rows, headerError } = csvToObjects<ImportRow>(text, COLUMNS);
  if (headerError) return { rows: [], error: headerError };
  const mismatch = headersMatch(headers, HEADERS);
  if (mismatch && rows.length > 0) return { rows, error: mismatch };
  if (rows.length === 0) {
    return { rows: [], error: "No data rows found." };
  }
  return { rows };
}

export function ImportDialog({ open, onClose, onDone }: Props) {
  const t = useT();
  const shifts = useShifts();
  const template = buildTemplate(shifts.map((s) => s.name));
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<TeacherImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setText("");
    setFileName(null);
    setStep("upload");
    setPreview([]);
    setParseError(null);
    setResult(null);
    setLoading(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setParseError(null);
      setPreview([]);
      setStep("upload");
    };
    reader.readAsText(file);
  }

  async function handlePreview() {
    setLoading(true);
    setParseError(null);
    try {
      const { rows, error } = parseTeacherCsv(text);
      if (error && rows.length === 0) {
        setParseError(error);
        return;
      }
      if (error) setParseError(error);
      setPreview(await previewTeacherImport(rows));
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const validRows = preview
        .filter((p) => p.status === "valid")
        .map((p) => p.data);
      const res = await bulkImport(validRows);
      setResult(res);
      setStep("result");
      onDone?.(res);
    } finally {
      setLoading(false);
    }
  }

  const validCount = preview.filter((p) => p.status === "valid").length;

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("teachersImportDialog.bulkImportTeachers")}
      description={t("teachersImportDialog.uploadOrPasteCsvReviewBefore")}
      className="max-w-3xl"
      footer={
        step === "result" ? (
          <Button onClick={() => { reset(); onClose(); }}>{t("teachersImportDialog.done")}</Button>
        ) : step === "preview" ? (
          <>
            <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>
              <ArrowLeft className="me-2 h-4 w-4" /> {t("teachersImportDialog.back")}
            </Button>
            <Button onClick={handleImport} disabled={loading || validCount === 0}>
              <Upload className="me-2 h-4 w-4" />
              {t("teachersImportDialog.import")} {validCount} {t("teachersImportDialog.teacher")}{validCount === 1 ? "" : "s"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => download("teachers-template.csv", template)}>
              <Download className="me-2 h-4 w-4" /> {t("teachersImportDialog.template")}
            </Button>
            <Button onClick={handlePreview} disabled={!text.trim() || loading}>
              <Eye className="me-2 h-4 w-4" />
              {loading ? "Validating…" : "Preview"}
            </Button>
          </>
        )
      }
    >
      {step === "result" && result ? (
        <ResultSummary result={result} />
      ) : step === "preview" ? (
        <PreviewTable preview={preview} />
      ) : (
        <div className="space-y-4">
          {parseError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {parseError}
            </p>
          )}
          <div>
            <Label>{t("teachersImportDialog.uploadCsv")}</Label>
            <label className="mt-1.5 flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-secondary">
              <FileUp className="h-4 w-4" />
              {fileName ?? "Choose file…"}
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <div>
            <Label>{t("teachersImportDialog.orPasteCsv")}</Label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setParseError(null); }}
              rows={7}
              placeholder={template}
              className="mt-1.5 w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PreviewTable({ preview }: { preview: TeacherImportPreviewRow[] }) {
  const t = useT();
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">{t("teachersImportDialog.row")}</th>
            <th className="px-3 py-2">{t("teachersImportDialog.name")}</th>
            <th className="px-3 py-2">{t("teachersImportDialog.phone")}</th>
            <th className="px-3 py-2">{t("teachersImportDialog.status")}</th>
            <th className="px-3 py-2">{t("teachersImportDialog.note")}</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((p) => (
            <tr key={p.row} className="border-t">
              <td className="px-3 py-2 font-mono">{p.row}</td>
              <td className="px-3 py-2">{p.data.fullName}</td>
              <td className="px-3 py-2">{p.data.phone}</td>
              <td className="px-3 py-2 capitalize">{p.status}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.message ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSummary({ result }: { result: ImportResult }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-emerald-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
          <p className="text-xs text-muted-foreground">{t("teachersImportDialog.imported")}</p>
        </div>
        <div className="rounded-xl border bg-amber-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
          <p className="text-xs text-muted-foreground">{t("teachersImportDialog.skipped")}</p>
        </div>
        <div className="rounded-xl border bg-rose-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-rose-600">{result.failed}</p>
          <p className="text-xs text-muted-foreground">{t("teachersImportDialog.failed")}</p>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border text-sm">
          {result.errors.map((e, i) => (
            <div key={i} className="border-t px-3 py-2 first:border-t-0">
              {t("teachersImportDialog.row")} {e.row || "—"}: {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
