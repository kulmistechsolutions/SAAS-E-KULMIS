"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  assertChildAccess,
  currentParent,
  getSelectedChildId,
  logPortalAudit,
  parentChildren,
  setSelectedChild,
  usePortalState,
} from "@/lib/parent-portal/store";
import type { Parent, Student } from "@/lib/students/types";

interface PortalContextValue {
  mounted: boolean;
  parent: Parent;
  children: Student[];
  selectedChild: Student | null;
  selectedChildId: string | null;
  setChild: (id: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children: node }: { children: ReactNode }) {
  const router = useRouter();
  const portal = usePortalState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const parent = useMemo(() => currentParent(), [portal.session]);
  const childList = useMemo(
    () => (parent ? parentChildren(parent.id) : []),
    [parent, portal.session],
  );
  const selectedChildId = parent ? getSelectedChildId(parent.id) : null;
  const selectedChild = useMemo(() => {
    if (!parent || !selectedChildId) return childList[0] ?? null;
    return assertChildAccess(parent.id, selectedChildId) ?? childList[0] ?? null;
  }, [parent, selectedChildId, childList]);

  useEffect(() => {
    if (!mounted) return;
    if (!portal.session) {
      router.replace("/parent-portal/login");
      return;
    }
    if (parent && selectedChild) {
      const key = getSelectedChildId(parent.id);
      if (!key && childList[0]) setSelectedChild(parent.id, childList[0].id);
    }
  }, [mounted, portal.session, parent, selectedChild, childList, router]);

  const setChild = useCallback(
    (id: string) => {
      if (!parent) return;
      setSelectedChild(parent.id, id);
    },
    [parent],
  );

  if (!mounted || !portal.session || !parent) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading portal…
      </div>
    );
  }

  return (
    <PortalContext.Provider
      value={{
        mounted,
        parent,
        children: childList,
        selectedChild,
        selectedChildId: selectedChild?.id ?? null,
        setChild,
      }}
    >
      {node}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}

export function usePortalAudit(action: Parameters<typeof logPortalAudit>[1], studentId?: string | null) {
  const { parent } = usePortal();
  useEffect(() => {
    logPortalAudit(parent.id, action, studentId ?? null);
  }, [parent.id, action, studentId]);
}
