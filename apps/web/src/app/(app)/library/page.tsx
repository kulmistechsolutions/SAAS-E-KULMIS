"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Library as LibraryIcon, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  apiCreateBook,
  apiDeleteBook,
  apiIssueBook,
  apiLibraryDashboard,
  apiListBooks,
  apiListLoans,
  apiReturnBook,
  type Book,
  type BookLoan,
  type LibraryDashboard,
} from "@/lib/library/api";
import {
  refreshStudents,
  useStudentsState,
} from "@/lib/students/store";
import { DocumentsTab } from "@/components/library/documents-tab";

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof BookOpen }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function LibraryPage() {
  const tr = useT();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"catalog" | "loans" | "documents">("catalog");
  const [dash, setDash] = useState<LibraryDashboard | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [q, setQ] = useState("");
  const { students } = useStudentsState();

  // Add-book form
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [copies, setCopies] = useState("1");

  // Issue form
  const [issueBookId, setIssueBookId] = useState("");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(async () => {
    const [d, b, l] = await Promise.all([
      apiLibraryDashboard().catch(() => null),
      apiListBooks(q || undefined).catch(() => [] as Book[]),
      apiListLoans({ status: "ISSUED" }).catch(() => [] as BookLoan[]),
    ]);
    if (d) setDash(d);
    setBooks(b);
    setLoans(l);
  }, [q]);

  useEffect(() => {
    setMounted(true);
    void refreshStudents();
  }, []);
  useEffect(() => {
    if (mounted) void load();
  }, [mounted, load]);

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "ACTIVE"),
    [students],
  );

  async function addBook() {
    if (!title.trim()) return toast("Title is required", "error");
    try {
      await apiCreateBook({
        title: title.trim(),
        author: author.trim() || null,
        category: category.trim() || null,
        totalCopies: Math.max(1, Number(copies) || 1),
      });
      setTitle("");
      setAuthor("");
      setCategory("");
      setCopies("1");
      toast("Book added", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add book", "error");
    }
  }

  async function issue() {
    if (!issueBookId || !issueStudentId || !dueDate) {
      return toast("Pick a book, a student and a due date", "error");
    }
    try {
      await apiIssueBook({ bookId: issueBookId, studentId: issueStudentId, dueDate });
      setIssueBookId("");
      setIssueStudentId("");
      setDueDate("");
      toast("Book issued", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not issue book", "error");
    }
  }

  async function returnLoan(id: string) {
    try {
      await apiReturnBook(id);
      toast("Book returned", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Return failed", "error");
    }
  }

  async function removeBook(b: Book) {
    try {
      await apiDeleteBook(b.id);
      toast("Book deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("library.library")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("library.manageTheBookCatalogueAndIssue")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={tr("library.titles")} value={dash?.totalTitles ?? 0} icon={LibraryIcon} />
        <StatCard label={tr("library.totalCopies")} value={dash?.totalCopies ?? 0} icon={BookOpen} />
        <StatCard label={tr("library.issued")} value={dash?.issued ?? 0} icon={BookOpen} />
        <StatCard label={tr("library.overdue")} value={dash?.overdue ?? 0} icon={RotateCcw} />
      </div>

      <div className="flex gap-2 border-b">
        {(["catalog", "loans", "documents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {t === "catalog"
              ? "Catalogue"
              : t === "loans"
                ? "Issued Books"
                : "PDF Books"}
          </button>
        ))}
      </div>

      {tab === "documents" && <DocumentsTab />}

      {tab === "catalog" && (
        <div className="space-y-4">
          {/* Add book */}
          <div className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-5">
            <Input placeholder={tr("library.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder={tr("library.author")} value={author} onChange={(e) => setAuthor(e.target.value)} />
            <Input placeholder={tr("library.category")} value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input type="number" min={1} placeholder={tr("library.copies")} value={copies} onChange={(e) => setCopies(e.target.value)} />
            <Button onClick={() => void addBook()}>
              <Plus className="mr-1.5 h-4 w-4" /> {tr("library.addBook")}
            </Button>
          </div>

          <Input
            placeholder={tr("library.searchTitleAuthorIsbnCategory")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr("library.title")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.author")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.category")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.available")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.total")}</th>
                  <th className="px-4 py-2.5 font-medium text-right">{tr("library.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{b.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.author ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.category ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{b.availableCopies}</td>
                    <td className="px-4 py-2.5 tabular-nums">{b.totalCopies}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => void removeBook(b)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        {tr("library.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
                {books.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {tr("library.noBooksYetAddOneAbove")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "loans" && (
        <div className="space-y-4">
          {/* Issue a book */}
          <div className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-4">
            <Select value={issueBookId} onChange={(e) => setIssueBookId(e.target.value)}>
              <option value="">{tr("library.selectBook")}</option>
              {books
                .filter((b) => b.availableCopies > 0 && b.status === "ACTIVE")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.availableCopies} {tr("library.left")}
                  </option>
                ))}
            </Select>
            <Select value={issueStudentId} onChange={(e) => setIssueStudentId(e.target.value)}>
              <option value="">{tr("library.selectStudent")}</option>
              {activeStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.code})
                </option>
              ))}
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Button onClick={() => void issue()}>{tr("library.issueBook")}</Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr("library.book")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.student")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.issued")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("library.due")}</th>
                  <th className="px-4 py-2.5 font-medium text-right">{tr("library.action")}</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const overdue = new Date(l.dueDate) < new Date();
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{l.book.title}</td>
                      <td className="px-4 py-2.5">
                        {l.student.fullName}{" "}
                        <span className="text-xs text-muted-foreground">({l.student.code})</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {l.issuedAt.slice(0, 10)}
                      </td>
                      <td className={`px-4 py-2.5 ${overdue ? "font-medium text-rose-600" : "text-muted-foreground"}`}>
                        {l.dueDate.slice(0, 10)}
                        {overdue ? " · overdue" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="outline" className="h-8" onClick={() => void returnLoan(l.id)}>
                          {tr("library.return")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {loans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {tr("library.noBooksCurrentlyIssued")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
