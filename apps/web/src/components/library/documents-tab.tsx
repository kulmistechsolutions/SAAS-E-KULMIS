"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Lock,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiDeleteLibraryDocument,
  apiLibraryStorageUsage,
  apiListLibraryDocuments,
  apiUploadLibraryDocument,
  libraryDocumentFileUrl,
  type LibraryDocument,
  type LibraryStorageUsage,
} from "@/lib/library/api";
import {
  activeAcademicYear,
  ensureAcademicsLoaded,
  useAcademicsState,
} from "@/lib/academics/store";
import { toast } from "@/lib/toast";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab() {
  const academics = useAcademicsState();
  const year = activeAcademicYear();

  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [usage, setUsage] = useState<LibraryStorageUsage | null>(null);
  const [q, setQ] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [loading, setLoading] = useState(true);

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const classes = useMemo(
    () => academics.classes.filter((c) => !year || c.academicYear === year),
    [academics.classes, year],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, u] = await Promise.all([
        apiListLibraryDocuments({
          q: q.trim() || undefined,
          classId: filterClassId || undefined,
        }),
        apiLibraryStorageUsage().catch(() => null),
      ]);
      setDocs(list);
      if (u) setUsage(u);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [q, filterClassId]);

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  function onPickFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      toast("Only PDF files can be uploaded", "error");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      toast(`That PDF is ${formatBytes(f.size)}. Maximum is 50 MB.`, "error");
      return;
    }
    setFile(f);
    // Offer the filename as the title so the admin rarely has to type one.
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  function resetForm() {
    setFile(null);
    setTitle("");
    setAuthor("");
    setDescription("");
    setClassId("");
    setAllowDownload(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function upload() {
    if (!file) return toast("Choose a PDF file", "error");
    if (!title.trim()) return toast("Title is required", "error");
    setUploading(true);
    try {
      await apiUploadLibraryDocument({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        author: author.trim() || undefined,
        classId: classId || undefined,
        allowDownload,
      });
      toast("Book uploaded", "success");
      resetForm();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function remove(doc: LibraryDocument) {
    if (!confirm(`Delete "${doc.title}"? This removes the PDF for good.`)) return;
    try {
      await apiDeleteLibraryDocument(doc.id);
      toast("Book deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  const usedPct =
    usage?.limitBytes && usage.limitBytes > 0
      ? Math.min(100, Math.round((usage.usedBytes / usage.limitBytes) * 100))
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* ── Upload ── */}
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">Upload a book</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PDF only, up to 50 MB. Students read it in their portal.
          </p>
        </div>

        {usage && (
          <div className="rounded-lg border bg-secondary/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Storage used</span>
              <span className="text-muted-foreground">
                {formatBytes(usage.usedBytes)}
                {usage.limitMb == null ? " (unlimited)" : ` / ${usage.limitMb} MB`}
              </span>
            </div>
            {usedPct != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full transition-all ${
                    usedPct >= 90 ? "bg-rose-500" : "bg-primary"
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="pdf">PDF file</Label>
          <input
            id="pdf"
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <p className="mt-1 text-xs text-muted-foreground">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            className="mt-1.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="doc-author">Author (optional)</Label>
          <Input
            id="doc-author"
            className="mt-1.5"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="doc-desc">Description (optional)</Label>
          <Textarea
            id="doc-desc"
            className="mt-1.5 min-h-[70px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="doc-class">Who can read it</Label>
          <Select
            id="doc-class"
            className="mt-1.5"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Every student in the school</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Only {c.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Locked to a class, no other class can see or open it.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(e) => setAllowDownload(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            Allow download
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Off = read on screen only, no download button.
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <Button onClick={() => void upload()} disabled={uploading || !file}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {file && (
            <Button variant="outline" onClick={resetForm} disabled={uploading}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by title, author…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-56"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : docs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-7 w-7 opacity-40" />
              No books uploaded yet.
            </div>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {d.author ? `${d.author} · ` : ""}
                      {formatBytes(d.fileSizeBytes)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          d.class
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {d.class ? (
                          <>
                            <Lock className="h-3 w-3" /> {d.class.name} only
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3" /> All students
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {d.allowDownload ? (
                          <>
                            <Download className="h-3 w-3" /> Download allowed
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" /> Read only
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a
                      href={libraryDocumentFileUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Preview"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void remove(d)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
