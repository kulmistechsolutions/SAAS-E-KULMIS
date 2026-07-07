"use client";

import { useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { bulkImport, type ImportResult, type ImportRow } from "@/lib/teachers/store";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: (result: ImportResult) => void;
}

const TEMPLATE = `Full Name,Gender,Phone,Salary,Shift
Ahmed Hassan,MALE,+252611100001,500,MORNING
Fatima Ali,FEMALE,+252611100002,480,AFTERNOON`;

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const [fullName, gender, phone, salary, shift] = line.split(",").map((c) => c.trim());
    return { fullName, gender, phone, salary, shift };
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
        errors: [{ row: 0, message: "No data rows found." }],
      });
      return;
    }
    const res = bulkImport(rows);
    setResult(res);
    onDone?.(res);
  }

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Bulk Import Teachers"
      description="Upload or paste CSV. Duplicate phones are skipped."
      className="max-w-2xl"
      footer={
        result ? (
          <Button onClick={() => { reset(); onClose(); }}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => download("teachers-template.csv", TEMPLATE)}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button onClick={handleImport} disabled={!text.trim()}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-emerald-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="rounded-xl border bg-amber-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="rounded-xl border bg-rose-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-rose-600">{result.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border text-sm">
              {result.errors.map((e, i) => (
                <div key={i} className="border-t px-3 py-2 first:border-t-0">
                  Row {e.row || "—"}: {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Upload CSV</Label>
            <label className="mt-1.5 flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-secondary">
              <FileUp className="h-4 w-4" />
              {fileName ?? "Choose file…"}
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <div>
            <Label>Or paste CSV</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder={TEMPLATE}
              className="mt-1.5 w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
