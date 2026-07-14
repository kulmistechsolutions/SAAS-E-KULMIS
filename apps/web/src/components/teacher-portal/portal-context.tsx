"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  canViewStudents,
  currentTeacherSession,
  getCachedTeacherProfile,
  logoutTeacher,
  refreshTeacherPortal,
  teacherPortalPermissions,
  useTeacherPortalState,
} from "@/lib/teacher-portal/store";
import { getCachedAuthUser } from "@/lib/auth";
import type { TeacherMe } from "@/lib/teachers/api";
import type { TeacherPortalPermissions } from "@/lib/teacher-portal/types";

interface TeacherPortalContextValue {
  mounted: boolean;
  teacher: TeacherMe;
  permissions: TeacherPortalPermissions;
  canViewStudents: boolean;
}

const TeacherPortalContext = createContext<TeacherPortalContextValue | null>(null);

export function TeacherPortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const portal = useTeacherPortalState();
  const [mounted, setMounted] = useState(false);
  const [teacher, setTeacher] = useState<TeacherMe | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!portal.session) {
      router.replace("/teacher-portal/login");
      return;
    }
    const role = getCachedAuthUser()?.role;
    if (role && role !== "TEACHER") {
      logoutTeacher();
      router.replace("/teacher-portal/login");
      return;
    }
    void refreshTeacherPortal().then(() => {
      setTeacher(getCachedTeacherProfile());
    });
  }, [mounted, portal.session, router]);

  const permissions = useMemo(
    () =>
      teacherPortalPermissions() ?? {
        canViewStudents: teacher?.canViewStudents ?? false,
        assignmentCount: teacher?.assignments.length ?? 0,
      },
    [portal.permissions, teacher],
  );

  // Empty shell until client mount — avoids SSR/localStorage hydration mismatch.
  if (!mounted) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-secondary/30"
        suppressHydrationWarning
        aria-busy="true"
      />
    );
  }

  if (!portal.session || !teacher) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading teacher portal…
      </div>
    );
  }

  return (
    <TeacherPortalContext.Provider
      value={{
        mounted,
        teacher,
        permissions,
        canViewStudents: canViewStudents(),
      }}
    >
      {children}
    </TeacherPortalContext.Provider>
  );
}

export function useTeacherPortal() {
  const ctx = useContext(TeacherPortalContext);
  if (!ctx) {
    throw new Error("useTeacherPortal must be used within TeacherPortalProvider");
  }
  return ctx;
}

export function useTeacherPortalSession() {
  return currentTeacherSession();
}
