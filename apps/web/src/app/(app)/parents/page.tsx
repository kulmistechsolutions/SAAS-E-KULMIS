"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  Download,
  Eye,
  FileDown,
  KeyRound,
  Pencil,
  Printer,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { AdminSummaryCards } from "@/components/parents/summary-cards";
import { ParentFormDialog } from "@/components/parents/parent-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  getParentWithChildren,
  listParents,
  resetParentPassword,
  setParentStatus,
  summarizeParents,
  useStudentsState,
} from "@/lib/students/store";
import { shortDate } from "@/lib/students/format";
import { exportParentsCsv, printParentProfile, printParentsList } from "@/lib/parents/print";
import type { ParentStatus } from "@/lib/students/types";
import type { ParentListRow } from "@/lib/students/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SortKey = "name" | "code" | "registrationDate" | "childCount";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

const STATUS_TONE: Record<ParentStatus, "success" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
};

export default function ParentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useStudentsState();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [childrenFilter, setChildrenFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("registrationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [editId, setEditId] = useState<string | null>(null);
  const [disableId, setDisableId] = useState<ParentListRow | null>(null);

  const summary = useMemo(() => summarizeParents(state), [state]);
  const all = useMemo(() => listParents(state), [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const studentNames = new Map<string, string>();
    for (const s of state.students) {
      studentNames.set(
        s.parentId,
        `${studentNames.get(s.parentId) ?? ""} ${s.fullName}`.trim(),
      );
    }

    const rows = all.filter((p) => {
      if (status && p.status !== status) return false;
      if (childrenFilter === "1" && p.childCount !== 1) return false;
      if (childrenFilter === "2+" && p.childCount < 2) return false;
      if (childrenFilter === "3+" && p.childCount < 3) return false;
      if (q) {
        const hay = `${p.code} ${p.name} ${p.phone} ${studentNames.get(p.id) ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "registrationDate")
        cmp = new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime();
      else if (sortKey === "childCount") cmp = a.childCount - b.childCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [all, state.students, search, status, childrenFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const editParent = editId ? getParentWithChildren(editId) : null;

  useEffect(() => setPage(1), [search, status, childrenFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "registrationDate" ? "desc" : "asc");
    }
  }

  async function handleDisable() {
    if (!disableId) return;
    const next: ParentStatus = disableId.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await setParentStatus(disableId.id, next);
    if (res.ok) {
      toast(
        `${disableId.name} is now ${next === "ACTIVE" ? "active" : "inactive"}.`,
        next === "ACTIVE" ? "success" : "info",
      );
    } else {
      toast(res.error ?? "Update failed", "error");
    }
    setDisableId(null);
  }

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading parents…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Parents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Parent accounts are created automatically when students register. Manage profiles and access here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => printParentsList(filtered, { status: status || "All" })}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => { exportParentsCsv(filtered); toast(`Exported ${filtered.length} parents.`, "info"); }}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <AdminSummaryCards summary={summary} />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, phone, or student name…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Select value={childrenFilter} onChange={(e) => setChildrenFilter(e.target.value)} className="w-40">
              <option value="">All Families</option>
              <option value="1">1 Child</option>
              <option value="2+">2+ Children</option>
              <option value="3+">3+ Children</option>
            </Select>
            {(search || status || childrenFilter) && (
              <Button variant="ghost" onClick={() => { setSearch(""); setStatus(""); setChildrenFilter(""); }}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <SortTh label="Parent ID" active={sortKey === "code"} dir={sortDir} onClick={() => toggleSort("code")} />
                <SortTh label="Parent Name" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <th className="px-4 py-3 font-medium">Phone</th>
                <SortTh label="Children" active={sortKey === "childCount"} dir={sortDir} onClick={() => toggleSort("childCount")} />
                <SortTh label="Reg. Date" active={sortKey === "registrationDate"} dir={sortDir} onClick={() => toggleSort("registrationDate")} />
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">No parents found.</td></tr>
              ) : (
                pageRows.map((p, i) => (
                  <tr key={p.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.code}</td>
                    <td className="px-4 py-3">
                      <Link href={`/parents/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                    <td className="px-4 py-3 tabular-nums">{p.childCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(p.registrationDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[p.status]} dot>
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Action href={`/parents/${p.id}`} title="View Profile" icon={Eye} />
                        <Action title="Edit" icon={Pencil} onClick={() => setEditId(p.id)} />
                        <Action title="Reset Password" icon={KeyRound} onClick={() => {
                          void resetParentPassword(p.id).then((res) => {
                            if (res.ok && res.password)
                              toast(`New password for ${p.code}: ${res.password}`, "info");
                            else toast(res.error ?? "Reset failed", "error");
                          });
                        }} />
                        <Action title="Print" icon={Printer} onClick={() => {
                          const full = getParentWithChildren(p.id);
                          if (full) printParentProfile(full, full.children);
                        }} />
                        <Action title="Download" icon={Download} onClick={() => exportParentsCsv([p], `${p.code}.csv`)} />
                        <Action
                          title={p.status === "ACTIVE" ? "Disable Account" : "Enable Account"}
                          icon={ShieldOff}
                          danger={p.status === "ACTIVE"}
                          onClick={() => setDisableId(p)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      <ParentFormDialog
        open={!!editParent}
        onClose={() => setEditId(null)}
        parent={editParent}
        onSaved={(m) => toast(m)}
      />
      <ConfirmDialog
        open={!!disableId}
        title={disableId?.status === "ACTIVE" ? "Disable Parent Account" : "Enable Parent Account"}
        message={
          disableId
            ? disableId.status === "ACTIVE"
              ? `Disable ${disableId.name} (${disableId.code})? They will not be able to log in to the parent portal.`
              : `Re-enable ${disableId.name} (${disableId.code})?`
            : ""
        }
        confirmLabel={disableId?.status === "ACTIVE" ? "Disable" : "Enable"}
        onConfirm={handleDisable}
        onClose={() => setDisableId(null)}
      />
    </div>
  );
}

function SortTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        <ArrowDownUp className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function Action({ icon: Icon, title, onClick, href, danger }: { icon: typeof Eye; title: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors", danger ? "hover:bg-rose-500/10 hover:text-rose-600" : "hover:bg-secondary hover:text-foreground");
  if (href) return <Link href={href} title={title} className={cls}><Icon className="h-4 w-4" /></Link>;
  return <button onClick={onClick} title={title} className={cls}><Icon className="h-4 w-4" /></button>;
}
