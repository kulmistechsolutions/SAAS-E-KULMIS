"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  apiStudentPortalMe,
  getStudentPortalToken,
  type StudentPortalMe,
} from "@/lib/student-portal/api";

interface StudentPortalContextValue {
  me: StudentPortalMe;
  refresh: () => Promise<void>;
}

const StudentPortalContext = createContext<StudentPortalContextValue | null>(null);

/**
 * Fetches the student's own profile exactly once per portal session and
 * shares it across every tab — previously each page called its own copy of
 * this hook, so switching tabs re-fetched /student-portal/me and re-showed
 * the full-page loading spinner on every single navigation.
 */
export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<StudentPortalMe | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!getStudentPortalToken()) {
      router.replace("/student-portal/login");
      return;
    }
    try {
      const res = await apiStudentPortalMe();
      setMe(res);
    } catch {
      router.replace("/student-portal/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-secondary/30 text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading…
      </div>
    );
  }

  return (
    <StudentPortalContext.Provider value={{ me, refresh: load }}>
      {children}
    </StudentPortalContext.Provider>
  );
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) {
    throw new Error("useStudentPortal must be used within StudentPortalProvider");
  }
  return ctx;
}
