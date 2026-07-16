"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle, ExternalLink, Trash2 } from "lucide-react";
import { SchoolStatusBadge } from "@/components/platform/school-status-badge";
import {
  loadSchool,
  removeSchool,
  updateSchool,
} from "@/lib/platform/data";
import { shortDate, tenantUrl } from "@/lib/platform/format";
import { usePlatformSchoolsState } from "@/lib/platform/store";
import type { PlatformSchool } from "@/lib/platform/types";
import {
  fetchPlatformSchoolSubscriptionDetail,
  type PlatformSchoolSubscriptionDetail,
} from "@/lib/platform/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

export default function PlatformSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const previewState = usePlatformSchoolsState();
  const [school, setSchool] = useState<PlatformSchool | null>(null);
  const [subDetail, setSubDetail] =
    useState<PlatformSchoolSubscriptionDetail | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadSchool(id),
      fetchPlatformSchoolSubscriptionDetail(id).catch(() => null),
    ])
      .then(([s, sub]) => {
        setSchool(s);
        if (s) setName(s.name);
        setSubDetail(sub);
      })
      .finally(() => setLoading(false));
  }, [id, previewState]);

  async function saveName() {
    if (!school || name.trim() === school.name) return;
    setSaving(true);
    try {
      const updated = await updateSchool(school.id, { name: name.trim() });
      setSchool(updated);
      toast("School updated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!school) return;
    const next = school.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (
      next === "SUSPENDED" &&
      !confirm(`Suspend "${school.name}"? Users will lose access.`)
    )
      return;
    try {
      const updated = await updateSchool(school.id, { status: next });
      setSchool(updated);
      toast(
        next === "SUSPENDED" ? "School suspended" : "School activated",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  async function handleDelete() {
    if (!school) return;
    if (
      !confirm(
        `Permanently delete "${school.name}" and ALL tenant data? This cannot be undone.`,
      )
    )
      return;
    try {
      await removeSchool(school.id);
      toast("School deleted", "success");
      router.push("/platform/schools");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  if (loading) return <div className="text-slate-400">Loading school…</div>;

  if (!school) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/schools"
          className="inline-flex items-center gap-2 text-sm text-violet-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to schools
        </Link>
        <p className="text-slate-400">School not found.</p>
      </div>
    );
  }

  const sub = subDetail?.subscription;

  return (
    <div className="space-y-6">
      <Link
        href="/platform/schools"
        className="inline-flex items-center gap-2 text-sm text-violet-400 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All Schools
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{school.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-400">
            {school.subdomain}
          </p>
        </div>
        <SchoolStatusBadge status={school.status} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-white">Current Subscription</h2>
          <Link
            href="/platform/subscriptions"
            className="text-xs text-violet-400 hover:underline"
          >
            Manage subscriptions
          </Link>
        </div>
        {sub ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-500">Plan</dt>
              <dd className="mt-0.5 font-medium text-white">{sub.plan.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-0.5 font-medium text-white">{sub.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expiry Date</dt>
              <dd className="mt-0.5 text-slate-200">{shortDate(sub.endDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Student Limit</dt>
              <dd className="mt-0.5 text-slate-200">
                {sub.studentLimit ?? "Unlimited"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Students Used</dt>
              <dd className="mt-0.5 text-slate-200">{sub.studentsUsed}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Students Remaining</dt>
              <dd className="mt-0.5 text-slate-200">
                {sub.studentsRemaining ?? "Unlimited"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">AI Limit</dt>
              <dd className="mt-0.5 text-slate-200">
                {sub.aiLimit ?? "Unlimited"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">AI Used</dt>
              <dd className="mt-0.5 text-slate-200">{sub.aiUsed}</dd>
            </div>
            <div>
              <dt className="text-slate-500">AI Remaining</dt>
              <dd className="mt-0.5 text-slate-200">
                {sub.aiRemaining ?? "Unlimited"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Assigned By</dt>
              <dd className="mt-0.5 text-slate-200">
                {sub.assignedByUsername ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Assigned Date</dt>
              <dd className="mt-0.5 text-slate-200">
                {shortDate(sub.assignedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Days Remaining</dt>
              <dd className="mt-0.5 text-slate-200">{sub.daysRemaining}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            No subscription assigned to this school.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold text-white">School Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">School ID</dt>
              <dd className="font-mono text-slate-200">{school.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Users</dt>
              <dd className="text-slate-200">{school.userCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Created</dt>
              <dd className="text-slate-200">{shortDate(school.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Tenant URL</dt>
              <dd>
                <a
                  href={tenantUrl(school.subdomain)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-violet-400 hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold text-white">Edit School</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">
                School Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <Button
              className="bg-violet-600 hover:bg-violet-500"
              disabled={saving || name.trim() === school.name}
              onClick={saveName}
            >
              {saving ? "Saving…" : "Save Name"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={toggleStatus}
        >
          {school.status === "ACTIVE" ? (
            <>
              <Ban className="mr-2 h-4 w-4" />
              Suspend School
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate School
            </>
          )}
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete School
        </Button>
      </div>
    </div>
  );
}
