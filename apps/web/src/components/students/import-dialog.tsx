"use client";

import { useEffect, useState } from "react";
import { Download, FileUp, Upload, ArrowLeft, Eye } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { ensureAcademicsLoaded } from "@/lib/academics/store";
import { csvToObjects, headersMatch } from "@/lib/csv";
import {
  bulkImport,
  previewImport,
  type ImportPreviewRow,
  type ImportResult,
  type ImportRow,
} from "@/lib/students/store";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: (result: ImportResult) => void;
}

const HEADERS = [
  "Student Name",
  "Gender",
  "Parent Name",
  "Parent Phone",
  "Class",
  "Section",
  "Monthly Fee",
];

const COLUMNS: (keyof ImportRow)[] = [
  "fullName",
  "gender",
  "parentName",
  "parentPhone",
  "className",
  "section",
  "monthlyFee",
];

const TEMPLATE = `${HEADERS.join(",")}
Amina Hassan,FEMALE,Mohamed Hassan,+252611000001,Grade 5,A,60
Yusuf Ali,MALE,Fadumo Ali,+252611000002,Grade 3,B,50`;

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

function parseStudentCsv(text: string): {
  rows: ImportRow[];
  error?: string;
} {
  const { headers, rows, headerError } = csvToObjects<ImportRow>(text, COLUMNS);
  if (headerError) return { rows: [], error: headerError };
  const mismatch = headersMatch(headers, HEADERS);
  if (mismatch && rows.length > 0) {
    return { rows, error: mismatch };
  }
  if (rows.length === 0) {
    return { rows: [], error: "No data rows found. Check the CSV format." };
  }
  return { rows };
}

export function ImportDialog({ open, onClose, onDone }: Props) {
  const { year: academicYear, setYear, years } = useAcademicYearSelect(
    "student-import-year",
  );
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) void ensureAcademicsLoaded();
  }, [open]);

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
      const { rows, error } = parseStudentCsv(text);
      if (error && rows.length === 0) {
        setParseError(error);
        return;
      }
      if (error) setParseError(error);
      const rowsPreview = await previewImport(rows, academicYear);
      setPreview(rowsPreview);
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
      const res = await bulkImport(validRows, academicYear);
      setResult(res);
      setStep("result");
      onDone?.(res);
    } finally {
      setLoading(false);
    }
  }

  const validCount = preview.filter((p) => p.status === "valid").length;
  const dupeCount = preview.filter((p) => p.status === "duplicate").length;
  const invalidCount = preview.filter((p) => p.status === "invalid").length;

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Bulk Import Students"
      description={
        step === "preview"
          ? "Review rows before importing. Only valid rows will be inserted."
          : "Upload a CSV or paste rows. Duplicates and invalid rows are skipped."
      }
      className="max-w-3xl"
      footer={
        step === "result" ? (
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </Button>
        ) : step === "preview" ? (
          <>
            <Button
              variant="outline"
              onClick={() => setStep("upload")}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || validCount === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import {validCount} student{validCount === 1 ? "" : "s"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => download("students-template.csv", TEMPLATE)}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button
              onClick={handlePreview}
              disabled={!text.trim() || loading || !academicYear}
            >
              <Eye className="mr-2 h-4 w-4" />
              {loading ? "Validating…" : "Preview"}
            </Button>
          </>
        )
      }
    >
      {step === "result" && result ? (
        <ImportSummary result={result} />
      ) : step === "preview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl border bg-emerald-500/10 p-3">
              <p className="text-xl font-bold text-emerald-600">{validCount}</p>
              <p className="text-xs text-muted-foreground">Ready to import</p>
            </div>
            <div className="rounded-xl border bg-amber-500/10 p-3">
              <p className="text-xl font-bold text-amber-600">{dupeCount}</p>
              <p className="text-xs text-muted-foreground">Duplicates (skip)</p>
            </div>
            <div className="rounded-xl border bg-rose-500/10 p-3">
              <p className="text-xl font-bold text-rose-600">{invalidCount}</p>
              <p className="text-xs text-muted-foreground">Invalid (skip)</p>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.row} className="border-t">
                    <td className="px-3 py-2 font-mono">{p.row}</td>
                    <td className="px-3 py-2">{p.data.fullName}</td>
                    <td className="px-3 py-2">{p.data.className}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {parseError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {parseError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Academic Year</Label>
              <Select
                value={academicYear}
                onChange={(e) => setYear(e.target.value)}
              >
                {years.length === 0 ? (
                  <option value="">Loading…</option>
                ) : (
                  years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))
                )}
              </Select>
            </div>
            <div>
              <Label>Upload CSV file</Label>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary">
                <FileUp className="h-4 w-4" />
                {fileName ?? "Choose file…"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>
          </div>
          <div>
            <Label>Or paste CSV rows</Label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setParseError(null);
              }}
              rows={8}
              spellCheck={false}
              placeholder={TEMPLATE}
              className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Columns: {HEADERS.join(", ")}
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function StatusBadge({ status }: { status: ImportPreviewRow["status"] }) {
  const styles = {
    valid: "text-emerald-600",
    duplicate: "text-amber-600",
    invalid: "text-rose-600",
  };
  const labels = {
    valid: "Valid",
    duplicate: "Duplicate",
    invalid: "Invalid",
  };
  return <span className={styles[status]}>{labels[status]}</span>;
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-emerald-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {result.imported}
          </p>
          <p className="text-xs text-muted-foreground">Imported</p>
        </div>
        <div className="rounded-xl border bg-amber-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {result.skipped}
          </p>
          <p className="text-xs text-muted-foreground">Skipped (dupes)</p>
        </div>
        <div className="rounded-xl border bg-rose-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {result.failed}
          </p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Issue</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono">{e.row || "—"}</td>
                  <td className="px-3 py-2">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
