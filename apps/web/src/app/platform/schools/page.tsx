"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { SchoolFormDialog } from "@/components/platform/school-form-dialog";
import { SchoolLoginsDialog } from "@/components/platform/school-logins-dialog";
import { SchoolStatusBadge } from "@/components/platform/school-status-badge";
import {
  SchoolTrialDialog,
  TrialCell,
} from "@/components/platform/school-trial-dialog";
import { createSchool, loadSchools } from "@/lib/platform/data";
import { shortDate, tenantUrl } from "@/lib/platform/format";
import { usePlatformSchoolsState } from "@/lib/platform/store";
import type { PlatformSchool } from "@/lib/platform/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import type { CreateSchoolInput } from "@ekulmis/shared";

export default function PlatformSchoolsPage() {
  const t = useT();
  const previewState = usePlatformSchoolsState();
  const [mounted, setMounted] = useState(false);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [loginsFor, setLoginsFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [trialFor, setTrialFor] = useState<{
    id: string;
    name: string;
    trialEndsAt: string | null;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    loadSchools().then(setSchools).catch(() => setSchools([]));
  }, [mounted, previewState]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.subdomain.toLowerCase().includes(q),
    );
  }, [schools, search]);

  async function handleCreate(values: CreateSchoolInput) {
    try {
      const res = await createSchool(values);
      toast(`School "${res.school.name}" provisioned`, "success");
      const list = await loadSchools();
      setSchools(list);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create school", "error");
      throw e;
    }
  }

  if (!mounted) return <div className="text-slate-400">{t("platformSchools.loadingSchools")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("platformSchools.schools")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("platformSchools.provisionSuspendAndManageTenantSchools")}
          </p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-500" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("platformSchools.newSchool")}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          className="border-white/10 bg-white/5 ps-9 text-white"
          placeholder={t("platformSchools.searchSchools")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-start text-slate-400">
              <th className="px-4 py-3">{t("platformSchools.school")}</th>
              <th className="px-4 py-3">{t("platformSchools.subdomain")}</th>
              <th className="px-4 py-3">{t("platformSchools.status")}</th>
              <th className="px-4 py-3">{t("platformSchools.users")}</th>
              <th className="px-4 py-3">{t("platformSchools.trial")}</th>
              <th className="px-4 py-3">{t("platformSchools.created")}</th>
              <th className="px-4 py-3">{t("platformSchools.tenantUrl")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/platform/schools/${s.id}`} className="font-medium text-white hover:text-violet-300">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{s.subdomain}</td>
                <td className="px-4 py-3"><SchoolStatusBadge status={s.status} /></td>
                <td className="px-4 py-3 text-slate-300">{s.userCount}</td>
                <td className="px-4 py-3"><TrialCell trialEndsAt={s.trialEndsAt} /></td>
                <td className="px-4 py-3 text-slate-400">{shortDate(s.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <a
                      href={tenantUrl(s.subdomain)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-violet-400 hover:underline"
                    >
                      {t("platformSchools.open")}
                    </a>
                    <button
                      type="button"
                      onClick={() => setLoginsFor({ id: s.id, name: s.name })}
                      className="text-xs text-slate-400 hover:text-white hover:underline"
                    >
                      {t("platformSchools.logins")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTrialFor({
                          id: s.id,
                          name: s.name,
                          trialEndsAt: s.trialEndsAt,
                        })
                      }
                      className="text-xs text-slate-400 hover:text-white hover:underline"
                    >
                      {t("platformSchools.trial")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  {t("platformSchools.noSchoolsMatchYourSearch")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SchoolFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <SchoolLoginsDialog
        open={!!loginsFor}
        onClose={() => setLoginsFor(null)}
        school={loginsFor}
      />

      {trialFor && (
        <SchoolTrialDialog
          school={trialFor}
          onClose={() => setTrialFor(null)}
          onSaved={() => {
            loadSchools().then(setSchools).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
