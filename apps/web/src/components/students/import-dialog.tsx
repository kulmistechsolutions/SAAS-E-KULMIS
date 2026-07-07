"use client";

import { useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ACADEMIC_YEARS, ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { bulkImport, type ImportResult, type ImportRow } from "@/lib/students/store";

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

const TEMPLATE = `${HEADERS.join(",")}
Amina Hassan,FEMALE,Mohamed Hassan,+252611000001,Grade 5,A,60
Yusuf Ali,MALE,Fadumo Ali,+252611000002,Grade 3,B,50`;

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      fullName: cols[0],
      gender: cols[1],
      parentName: cols[2],
      parentPhone: cols[3],
      className: cols[4],
      section: cols[5],
      monthlyFee: cols[6],
    };
  });
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDialog({ open, onClose, onDone }: Props) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState<string>(ACTIVE_ACADEMIC_YEAR);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setText("");
    setFileName(null);
    setResult(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function handleImport() {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setResult({
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [{ row: 0, message: "No data rows found. Check the CSV format." }],
      });
      return;
    }
    const res = bulkImport(rows, academicYear);
    setResult(res);
    onDone?.(res);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Bulk Import Students"
      description="Upload a CSV or paste rows. Duplicates and invalid rows are skipped."
      className="max-w-2xl"
      footer={
        result ? (
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => download("students-template.csv", TEMPLATE)}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button onClick={handleImport} disabled={!text.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
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
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Academic Year</Label>
              <Select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
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
              onChange={(e) => setText(e.target.value)}
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
