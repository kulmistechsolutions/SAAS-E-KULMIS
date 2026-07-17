"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, Eye, Loader2, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLibraryPortalAuth } from "@/lib/library-portal/use-library-portal-auth";
import {
  apiLibraryPortalBooks,
  libraryPortalLogout,
  type LibraryPortalBook,
} from "@/lib/library-portal/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryPortalHomePage() {
  const router = useRouter();
  const { me, loading: authLoading } = useLibraryPortalAuth();
  const [books, setBooks] = useState<LibraryPortalBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!me) return;
    apiLibraryPortalBooks()
      .then(setBooks)
      .finally(() => setLoading(false));
  }, [me]);

  function signOut() {
    libraryPortalLogout();
    router.replace("/library-portal/login");
  }

  const filtered = books.filter((b) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      b.title.toLowerCase().includes(s) || (b.author ?? "").toLowerCase().includes(s)
    );
  });

  if (authLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold leading-tight">{me.schoolName}</p>
              <p className="text-xs text-muted-foreground">
                {me.student.fullName} · {me.student.className}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search books…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading books…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {books.length === 0 ? "No books available yet." : "No books match your search."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/library-portal/read/${b.id}`)}
                className="flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-32 w-full items-center justify-center rounded-xl bg-primary/5">
                  <BookOpen className="h-10 w-10 text-primary/50" />
                </div>
                <p className="line-clamp-2 font-medium">{b.title}</p>
                {b.author && (
                  <p className="text-xs text-muted-foreground">{b.author}</p>
                )}
                <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5">
                    {b.allowDownload ? (
                      <>
                        <Download className="h-3 w-3" /> Downloadable
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Read only
                      </>
                    )}
                  </span>
                  <span>{formatBytes(b.fileSizeBytes)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
