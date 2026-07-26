"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import {
  approvePlatformSenderId,
  fetchPlatformSenderIdRequests,
  openPlatformSenderIdDocument,
  rejectPlatformSenderId,
  type PlatformSenderIdRequest,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
}

/**
 * Sender ID applications, for the platform owner.
 *
 * A school can ask for a name but not grant it — the operator registers the
 * name against a licensed organisation, and that is done here. On approval the
 * owner types the name actually registered, which may differ from the request,
 * and it becomes the school's sending name immediately.
 */
export function SenderIdReview() {
  const t = useT();
  const [rows, setRows] = useState<PlatformSenderIdRequest[]>([]);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Per-row editable approved name, seeded from what the school asked for. */
  const [names, setNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    void fetchPlatformSenderIdRequests()
      .then((res) => {
        setFeatureEnabled(res.featureEnabled);
        setRows(res.requests);
        setNames(
          Object.fromEntries(
            res.requests
              .filter((r) => r.status === "PENDING")
              .map((r) => [r.id, r.requestedName]),
          ),
        );
      })
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : "Could not load", "error"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function approve(row: PlatformSenderIdRequest) {
    const approvedName = (names[row.id] ?? row.requestedName).trim();
    if (approvedName.length < 3) {
      toast("The sender name needs at least 3 characters.", "error");
      return;
    }
    setBusyId(row.id);
    try {
      await approvePlatformSenderId(row.id, {
        approvedName,
        reviewNote: notes[row.id]?.trim() || null,
      });
      toast(`${row.school.name} now sends as "${approvedName}".`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approve failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: PlatformSenderIdRequest) {
    const note = notes[row.id]?.trim();
    if (!note) {
      toast("Write the reason — the school has to know what to fix.", "error");
      return;
    }
    setBusyId(row.id);
    try {
      await rejectPlatformSenderId(row.id, note);
      toast(`Application from ${row.school.name} rejected.`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reject failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  const pending = rows.filter((r) => r.status === "PENDING");
  const decided = rows.filter((r) => r.status !== "PENDING");

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("platformSenderIdReview.loadingApplications")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {!featureEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-100">
          <p className="font-semibold">
            {t("platformSenderIdReview.senderNamesAreSwitchedOffApproving")}
          </p>
          <p className="mt-1 text-amber-200/90">
            {t("platformSenderIdReview.messagesGoOutUnderTheName")} <code>{t("platformSenderIdReview.sms_sender_id_enabledTrue")}</code> {t("platformSenderIdReview.onTheApiToTurnThis")}
          </p>
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          <h2 className="font-semibold text-white">
            {t("platformSenderIdReview.senderIdApplications")}{pending.length} {t("platformSenderIdReview.awaiting")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-white/60">
          {t("platformSenderIdReview.schoolsApplyForTheNameRecipients")}
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-slate-400">
          {t("platformSenderIdReview.noApplicationsAwaitingReview")}
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{r.school.name}</p>
                  <p className="font-mono text-xs text-white/50">
                    {r.school.subdomain}
                  </p>
                </div>
                <p className="text-xs text-white/50">
                  {t("platformSenderIdReview.applied")} {when(r.createdAt)}
                </p>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-white/50">{t("platformSenderIdReview.nameRequested")}</dt>
                  <dd className="mt-0.5 font-mono text-base font-bold text-white">
                    {r.requestedName}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/50">{t("platformSenderIdReview.contact")}</dt>
                  <dd className="mt-0.5 text-white/80">
                    {r.contactPerson ?? "—"}
                    {r.contactPhone ? ` · ${r.contactPhone}` : ""}
                  </dd>
                </div>
                {r.note && (
                  <div className="sm:col-span-2">
                    <dt className="text-white/50">{t("platformSenderIdReview.schoolAposSNote")}</dt>
                    <dd className="mt-0.5 text-white/80">{r.note}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4">
                {r.hasDocument ? (
                  <button
                    type="button"
                    onClick={() =>
                      void openPlatformSenderIdDocument(r.id).catch((e) =>
                        toast(
                          e instanceof Error ? e.message : "Could not open",
                          "error",
                        ),
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                  >
                    <FileText className="h-4 w-4" />
                    {t("platformSenderIdReview.viewLicence")}
                    {r.licenseDocName ? ` (${r.licenseDocName})` : ""}
                  </button>
                ) : (
                  <p className="text-sm text-amber-300">
                    {t("platformSenderIdReview.noLicenceAttachedVerifyByOther")}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/70">
                    {t("platformSenderIdReview.nameToRegisterWhatWillBe")}
                  </label>
                  <input
                    value={names[r.id] ?? r.requestedName}
                    onChange={(e) =>
                      setNames((p) => ({ ...p, [r.id]: e.target.value }))
                    }
                    maxLength={11}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/70">
                    {t("platformSenderIdReview.noteToTheSchoolRequiredTo")}
                  </label>
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((p) => ({ ...p, [r.id]: e.target.value }))
                    }
                    placeholder={t("platformSenderIdReview.eGLicenceUnreadableSendA")}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void approve(r)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busyId === r.id ? "Working…" : "Approve & set sender ID"}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void reject(r)}
                  className="rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  {t("platformSenderIdReview.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <p className="border-b border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
            {t("platformSenderIdReview.decided")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.school")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.requested")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.registered")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.result")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.by")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("platformSenderIdReview.when")}</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-4 py-2.5 text-white">{r.school.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/70">
                      {r.requestedName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white">
                      {r.approvedName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                        title={r.reviewNote ?? undefined}
                      >
                        {r.status === "APPROVED" ? "Approved" : "Rejected"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white/60">
                      {r.reviewedByUsername ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-white/60">
                      {when(r.reviewedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
