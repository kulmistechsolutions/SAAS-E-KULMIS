"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SenderIdReview } from "@/components/platform/sender-id-review";
import { GatewayCredentialsDialog } from "@/components/platform/gateway-credentials-dialog";
import { Dialog } from "@/components/ui/dialog";
import {
  adjustPlatformSmsCredits,
  assignPlatformSmsPackage,
  createPlatformSmsPackage,
  deletePlatformSmsPackage,
  updatePlatformSmsPackage,
  fetchPlatformSmsGatewayLicenses,
  fetchPlatformSmsMessages,
  type PlatformSmsMessage,
  fetchPlatformSmsOverview,
  grantPlatformSmsGatewayLicense,
  revokePlatformSmsGatewayLicense,
  setPlatformSmsPackageActive,
  type PlatformSmsGatewayLicense,
  type PlatformSmsOverview,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";

export default function PlatformSmsPackagesPage() {
  const t = useT();
  const [data, setData] = useState<PlatformSmsOverview | null>(null);
  const [messages, setMessages] = useState<PlatformSmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "packages" | "assign" | "gateways" | "sender-ids" | "logs"
  >("packages");

  const [pkgName, setPkgName] = useState("");
  const [pkgCredits, setPkgCredits] = useState("100");
  const [pkgPrice, setPkgPrice] = useState("10");
  const [pkgDesc, setPkgDesc] = useState("");

  /**
   * The package being edited, as a draft.
   *
   * A price or a credit count typed wrong could only be fixed by deactivating
   * the package and making another one beside it, which leaves the school
   * looking at two packages with the same name. Editing changes the offer from
   * here on; purchases already made keep the credits and the price they were
   * sold at, because a receipt is a record of what happened.
   */
  const [editPkg, setEditPkg] = useState<{
    id: string;
    name: string;
    credits: string;
    price: string;
    currency: string;
  } | null>(null);
  const [deletePkg, setDeletePkg] = useState<{ id: string; name: string } | null>(
    null,
  );

  const [assignSchool, setAssignSchool] = useState("");
  const [assignPkg, setAssignPkg] = useState("");

  const [adjustSchool, setAdjustSchool] = useState("");
  const [adjustCredits, setAdjustCredits] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [gwLicenses, setGwLicenses] = useState<PlatformSmsGatewayLicense[]>([]);
  const [gwSchool, setGwSchool] = useState("");
  const [gwMonths, setGwMonths] = useState(12);
  const [gwPrice, setGwPrice] = useState("");
  const [gwNote, setGwNote] = useState("");
  const [credsSchool, setCredsSchool] = useState<{ id: string; name: string } | null>(
    null,
  );

  const unlocked = Boolean(data?.config.packagesUnlocked);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, msgs, licenses] = await Promise.all([
        fetchPlatformSmsOverview(),
        fetchPlatformSmsMessages(),
        fetchPlatformSmsGatewayLicenses().catch(
          () => [] as PlatformSmsGatewayLicense[],
        ),
      ]);
      setData(ov);
      setMessages(msgs.items);
      setGwLicenses(licenses);
      setAssignSchool((prev) => prev || ov.schools[0]?.id || "");
      setAssignPkg(
        (prev) => prev || ov.packages.find((p) => p.isActive)?.id || "",
      );
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to load SMS data",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function grantGateway() {
    if (!gwSchool) return;
    try {
      await grantPlatformSmsGatewayLicense({
        schoolId: gwSchool,
        durationMonths: gwMonths,
        price: gwPrice.trim() === "" ? null : Number(gwPrice),
        note: gwNote.trim() || null,
      });
      toast("Own-gateway licence activated", "success");
      setGwPrice("");
      setGwNote("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not activate", "error");
    }
  }

  async function revokeGateway(id: string) {
    if (
      !confirm(
        "Revoke this licence? The school falls back to platform credits.",
      )
    )
      return;
    try {
      await revokePlatformSmsGatewayLicense(id);
      toast("Licence revoked", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not revoke", "error");
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function createPackage() {
    if (!unlocked) {
      toast("Verify Hormuud connection in SMS Settings first.", "error");
      return;
    }
    try {
      await createPlatformSmsPackage({
        name: pkgName,
        description: pkgDesc || undefined,
        credits: Number(pkgCredits),
        price: Number(pkgPrice),
      });
      setPkgName("");
      setPkgDesc("");
      toast("Package created", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed", "error");
    }
  }

  async function saveEdit() {
    if (!editPkg) return;
    const credits = Number(editPkg.credits);
    const price = Number(editPkg.price);
    if (!editPkg.name.trim()) return toast("Name the package.", "error");
    if (!Number.isInteger(credits) || credits <= 0)
      return toast("Credits must be a whole number above zero.", "error");
    if (!Number.isFinite(price) || price < 0)
      return toast("Price cannot be negative.", "error");
    try {
      await updatePlatformSmsPackage(editPkg.id, {
        name: editPkg.name.trim(),
        credits,
        price,
        currency: editPkg.currency.trim() || "USD",
      });
      toast("Package updated", "success");
      setEditPkg(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  async function removePackage() {
    if (!deletePkg) return;
    try {
      await deletePlatformSmsPackage(deletePkg.id);
      // A package a school has already bought is never really deleted — the
      // server deactivates it instead, so the purchase it belongs to keeps
      // its name. Saying so beats a school's history quietly losing a label.
      toast(
        "Package removed. One a school has already bought is kept, deactivated, so its purchases still read correctly.",
        "success",
      );
      setDeletePkg(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  async function assign() {
    if (!unlocked) {
      toast("Verify Hormuud connection in SMS Settings first.", "error");
      return;
    }
    try {
      await assignPlatformSmsPackage({
        schoolId: assignSchool,
        packageId: assignPkg,
      });
      toast("Package assigned to school", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Assign failed", "error");
    }
  }

  async function adjustCreditsForSchool() {
    const credits = Number(adjustCredits);
    if (!adjustSchool || !Number.isInteger(credits) || credits === 0) {
      toast("Select a school and enter a non-zero whole number of credits", "error");
      return;
    }
    setAdjusting(true);
    try {
      await adjustPlatformSmsCredits({
        schoolId: adjustSchool,
        credits,
        description: adjustNote.trim() || "Manual payment confirmed",
      });
      const school = data?.schools.find((s) => s.id === adjustSchool);
      toast(`${credits > 0 ? "+" : ""}${credits} credits applied${school ? ` to ${school.name}` : ""}`, "success");
      setAdjustCredits("");
      setAdjustNote("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Adjust failed", "error");
    } finally {
      setAdjusting(false);
    }
  }

  if (loading && !data) {
    return <p className="text-slate-400">{t("platformSms.loadingSmsPackages")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <MessageSquare className="h-6 w-6 text-violet-400" />
            {t("platformSms.smsPackages")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("platformSms.createPackagesAndAssignCreditsTo")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Suspension and per-school ceilings. Kept off the school entirely:
              a school uses SMS, it does not govern it. */}
          <Link
            href="/platform/sms/schools"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm text-slate-200 hover:bg-white/5"
          >
            <ShieldCheck className="h-4 w-4" />
            School accounts
          </Link>
          <Link
            href="/platform/sms/settings"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm text-slate-200 hover:bg-white/5"
          >
            <Settings2 className="h-4 w-4" />
            {t("platformSms.smsSettings")}
          </Link>
          <Button
            variant="outline"
            onClick={() => void load()}
            className="border-white/20 text-slate-200"
          >
            <RefreshCw className="me-2 h-4 w-4" /> {t("platformSms.refresh")}
          </Button>
        </div>
      </div>

      {!unlocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("platformSms.packagesLocked")}</p>
            <p className="mt-0.5 text-amber-100/80">
              {t("platformSms.status")} {data?.config.connectionStatus ?? "DISCONNECTED"}
              {data?.config.connectionMessage
                ? ` — ${data.config.connectionMessage}`
                : ""}
              .{" "}
              <Link href="/platform/sms/settings" className="underline">
                {t("platformSms.openSmsSettings")}
              </Link>{" "}
              {t("platformSms.andRunTestConnectionSaveFirst")}
            </p>
          </div>
        </div>
      )}

      {/* Reconciliation. The two figures either side of this line are what the
          platform has promised and what it can actually pay out of; they are
          allowed to drift apart quietly for weeks, and then everything stops at
          once. Read six-hourly, not at Test Connection, so it is about today. */}
      {data?.balanceHealth && (
        <div
          className={`rounded-2xl border p-5 ${
            data.balanceHealth.oversold
              ? "border-rose-500/40 bg-rose-500/10"
              : data.balanceHealth.unknown || data.balanceHealth.stale
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-white/10 bg-[#0f172a]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Credit cover</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                What schools still hold, against what the provider account can
                cover.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                data.balanceHealth.oversold
                  ? "bg-rose-500/20 text-rose-200"
                  : data.balanceHealth.unknown
                    ? "bg-amber-500/20 text-amber-200"
                    : data.balanceHealth.stale
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {data.balanceHealth.oversold
                ? "Oversold"
                : data.balanceHealth.unknown
                  ? "Never checked"
                  : data.balanceHealth.stale
                    ? "Out of date"
                    : "Covered"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Provider balance</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                {data.balanceHealth.providerBalance === null
                  ? "—"
                  : data.balanceHealth.providerBalance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Credits schools hold</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                {data.balanceHealth.creditsOutstanding.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cover</p>
              <p
                className={`mt-0.5 text-xl font-bold tabular-nums ${
                  data.balanceHealth.drift === null
                    ? "text-slate-500"
                    : data.balanceHealth.drift < 0
                      ? "text-rose-300"
                      : "text-emerald-300"
                }`}
              >
                {data.balanceHealth.drift === null
                  ? "—"
                  : data.balanceHealth.drift.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-400">
            {data.balanceHealth.oversold
              ? "Schools hold more credits than the provider account can deliver. Top up the provider account, or stop assigning packages until it is topped up."
              : data.balanceHealth.unknown
                ? "The provider balance has not been read yet. It syncs every six hours once the connection is enabled."
                : data.balanceHealth.stale
                  ? "This reading is more than a day old, so treat it as an indication rather than a fact."
                  : "Every credit sold is covered by the provider account."}
            {data.balanceHealth.checkedAt && (
              <>
                {" "}
                Last read{" "}
                {new Date(data.balanceHealth.checkedAt).toLocaleString()}.
              </>
            )}
          </p>
        </div>
      )}

      {unlocked && data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
            <p className="text-xs text-slate-500">{t("platformSms.connection")}</p>
            <p className="font-semibold text-emerald-300">
              {data.config.connectionStatus}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
            <p className="text-xs text-slate-500">{t("platformSms.providerBalance")}</p>
            <p className="font-semibold text-violet-300">
              {data.config.providerBalance ?? "—"}
            </p>
          </div>
          {data.deliveryStats.slice(0, 2).map((s) => (
            <div
              key={s.status}
              className="rounded-xl border border-white/10 bg-[#0f172a] p-3"
            >
              <p className="text-xs text-slate-500">{s.status}</p>
              <p className="font-semibold text-white">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["packages", "Packages"],
            ["assign", "Assign"],
            ["gateways", "Own gateways"],
            ["sender-ids", "Sender IDs"],
            ["logs", "Delivery logs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-violet-600 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "packages" && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">{t("platformSms.createPackage")}</h2>
            {!unlocked && (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {t("platformSms.lockedUntilConnectionVerified")}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-slate-400">{t("platformSms.name")}</Label>
                <Input
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  disabled={!unlocked}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">{t("platformSms.credits")}</Label>
                  <Input
                    type="number"
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={pkgCredits}
                    onChange={(e) => setPkgCredits(e.target.value)}
                    disabled={!unlocked}
                  />
                </div>
                <div>
                  <Label className="text-slate-400">{t("platformSms.price")}</Label>
                  <Input
                    type="number"
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    disabled={!unlocked}
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-400">{t("platformSms.description")}</Label>
                <Input
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={pkgDesc}
                  onChange={(e) => setPkgDesc(e.target.value)}
                  disabled={!unlocked}
                />
              </div>
              <Button
                onClick={() => void createPackage()}
                disabled={!unlocked || !pkgName}
              >
                <Plus className="me-2 h-4 w-4" /> {t("platformSms.create")}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">{t("platformSms.packages")}</h2>
            <ul className="mt-3 space-y-2">
              {data.packages.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.credits} {t("platformSms.credits")} {p.currency} {String(p.price)}
                      {!p.isActive && " · inactive"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-white/20 text-xs text-slate-200"
                      disabled={!unlocked}
                      onClick={() =>
                        setEditPkg({
                          id: p.id,
                          name: p.name,
                          credits: String(p.credits),
                          price: String(p.price),
                          currency: p.currency,
                        })
                      }
                    >
                      <Pencil className="me-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/20 text-xs text-slate-200"
                      disabled={!unlocked}
                      onClick={() =>
                        void setPlatformSmsPackageActive(p.id, !p.isActive).then(
                          load,
                        )
                      }
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-rose-500/40 text-xs text-rose-300 hover:bg-rose-500/10"
                      disabled={!unlocked}
                      onClick={() => setDeletePkg({ id: p.id, name: p.name })}
                    >
                      <Trash2 className="me-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
              {data.packages.length === 0 && (
                <p className="text-sm text-slate-500">{t("platformSms.noPackagesYet")}</p>
              )}
            </ul>
          </div>

          {/* What each school bought, and what became of it. A package that
              ran out and a package that expired are different things, and
              the console could show neither. */}
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5 lg:col-span-2">
            <h2 className="font-semibold text-white">Packages schools have bought</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Newest first. &ldquo;Used up&rdquo; means the credits were spent;
              &ldquo;Expired&rdquo; means a term ran out with credits still on it.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">School</th>
                    <th className="px-3 py-2 text-start font-medium">Package</th>
                    <th className="px-3 py-2 text-end font-medium">Credits</th>
                    <th className="px-3 py-2 text-end font-medium">Left</th>
                    <th className="px-3 py-2 text-start font-medium">Status</th>
                    <th className="px-3 py-2 text-start font-medium">Bought</th>
                    <th className="px-3 py-2 text-start font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPurchases.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-white">{r.school.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {r.school.subdomain}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{r.package.name}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums text-slate-300">
                        {r.creditsTotal}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-end font-semibold tabular-nums ${
                          r.creditsRemaining > 0 ? "text-emerald-300" : "text-slate-500"
                        }`}
                      >
                        {r.creditsRemaining}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            r.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : r.status === "EXHAUSTED"
                                ? "bg-slate-500/20 text-slate-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {r.status === "EXHAUSTED"
                            ? "Used up"
                            : r.status === "ACTIVE"
                              ? "Active"
                              : r.status === "EXPIRED"
                                ? "Expired"
                                : "Cancelled"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                        {r.purchasedAt.slice(0, 10)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                        {r.expiresAt ? r.expiresAt.slice(0, 10) : "No end date"}
                      </td>
                    </tr>
                  ))}
                  {data.recentPurchases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                        No school has bought a package yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "assign" && data && (
        <div className="max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] p-5">
          <h2 className="font-semibold text-white">{t("platformSms.assignPackageToSchool")}</h2>
          {!unlocked && (
            <p className="mt-2 text-sm text-amber-300">
              {t("platformSms.assignmentIsLockedUntilHormuudIs")}
            </p>
          )}
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-slate-400">{t("platformSms.school")}</Label>
              <Select
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={assignSchool}
                onChange={(e) => setAssignSchool(e.target.value)}
                disabled={!unlocked}
              >
                {data.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.creditsRemaining} {t("platformSms.left")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">{t("platformSms.package")}</Label>
              <Select
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={assignPkg}
                onChange={(e) => setAssignPkg(e.target.value)}
                disabled={!unlocked}
              >
                {data.packages
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.credits} {t("platformSms.credits")}
                    </option>
                  ))}
              </Select>
            </div>
            <Button
              onClick={() => void assign()}
              disabled={!unlocked || !assignSchool || !assignPkg}
            >
              {t("platformSms.assignPackage")}
            </Button>
          </div>
          <div className="mt-6 border-t border-white/10 pt-5">
            <h2 className="font-semibold text-white">Adjust credits manually</h2>
            <p className="mt-1 text-xs text-slate-400">
              Tops up (or corrects) a school&apos;s existing balance once
              you&apos;ve confirmed their manual payment (Waafi Payments → Gateway
              settings → Manual payment). If this school has never had a
              package before, use Assign Package above first — this only
              adjusts an existing wallet.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-slate-400">{t("platformSms.school")}</Label>
                <Select
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={adjustSchool}
                  onChange={(e) => setAdjustSchool(e.target.value)}
                >
                  <option value="">{t("platformSms.selectASchool")}</option>
                  {data.schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.creditsRemaining} {t("platformSms.left")})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Credits (+/-)</Label>
                  <Input
                    type="number"
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={adjustCredits}
                    onChange={(e) => setAdjustCredits(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Note (optional)</Label>
                  <Input
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="e.g. EVC Plus transfer confirmed"
                  />
                </div>
              </div>
              <Button
                onClick={() => void adjustCreditsForSchool()}
                disabled={!adjustSchool || !adjustCredits || adjusting}
              >
                Apply credits
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-300">
              {t("platformSms.recentPurchases")}
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {data.recentPurchases.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-white/5 px-3 py-2 text-slate-400"
                >
                  <span className="text-white">{p.school.name}</span> {t("platformSms.bought")}{" "}
                  <span className="text-violet-300">{p.package.name}</span> (
                  {p.creditsRemaining}/{p.creditsTotal})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "gateways" && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">
              {t("platformSms.sellQuotUseYourOwnSms")}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t("platformSms.letsASchoolConnectItsOwn")}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-slate-400">{t("platformSms.school")}</Label>
                <Select
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={gwSchool}
                  onChange={(e) => setGwSchool(e.target.value)}
                >
                  <option value="">{t("platformSms.selectASchool")}</option>
                  {data.schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">{t("platformSms.duration")}</Label>
                  <Select
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={String(gwMonths)}
                    onChange={(e) => setGwMonths(Number(e.target.value))}
                  >
                    <option value="1">{t("platformSms.n1Month")}</option>
                    <option value="3">{t("platformSms.n3Months")}</option>
                    <option value="6">{t("platformSms.n6Months")}</option>
                    <option value="12">{t("platformSms.n12MonthsYearly")}</option>
                    <option value="24">{t("platformSms.n24Months")}</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">{t("platformSms.priceOptional")}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={gwPrice}
                    onChange={(e) => setGwPrice(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-400">{t("platformSms.noteOptional")}</Label>
                <Input
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={gwNote}
                  onChange={(e) => setGwNote(e.target.value)}
                />
              </div>
              <Button onClick={() => void grantGateway()} disabled={!gwSchool}>
                {t("platformSms.activateForThisSchool")}
              </Button>
              <p className="text-xs text-slate-500">
                {t("platformSms.renewingASchoolThatStillHas")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h3 className="text-sm font-medium text-slate-300">{t("platformSms.licences")}</h3>
            {gwLicenses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {t("platformSms.noSchoolIsUsingItsOwn")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {gwLicenses.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-white">{l.school.name}</p>
                      <p className="text-xs text-slate-400">
                        {l.durationMonths} {t("platformSms.monthS")}{" "}
                        {new Date(l.startDate).toLocaleDateString()} →{" "}
                        {new Date(l.endDate).toLocaleDateString()}
                        {l.price != null ? ` · ${l.currency} ${l.price}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          l.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/5 text-slate-400"
                        }`}
                      >
                        {l.status}
                      </span>
                      {l.status === "ACTIVE" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setCredsSchool({ id: l.school.id, name: l.school.name })
                            }
                            className="text-xs text-sky-300 hover:text-sky-200"
                          >
                            Manage credentials
                          </button>
                          <button
                            type="button"
                            onClick={() => void revokeGateway(l.id)}
                            className="text-xs text-rose-300 hover:text-rose-200"
                          >
                            {t("platformSms.revoke")}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "sender-ids" && <SenderIdReview />}

      {tab === "logs" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-start text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("platformSms.school")}</th>
                  <th className="px-4 py-3">{t("platformSms.to")}</th>
                  <th className="px-4 py-3">{t("platformSms.sender")}</th>
                  <th className="px-4 py-3">{t("platformSms.status")}</th>
                  <th className="px-4 py-3">{t("platformSms.credits")}</th>
                  <th className="px-4 py-3">{t("platformSms.when")}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="px-4 py-2 text-slate-300">{m.school.name}</td>
                    <td className="px-4 py-2">
                      <p className="text-white">{m.recipientName ?? "—"}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {m.recipientPhone}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-slate-400">{m.senderId}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          m.status === "SENT" || m.status === "DELIVERED"
                            ? "text-emerald-400"
                            : m.status === "FAILED"
                              ? "text-rose-400"
                              : "text-amber-400"
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-400">
                      {m.creditsUsed}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      {t("platformSms.noMessagesLoggedYet")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {credsSchool && (
        <GatewayCredentialsDialog
          open={Boolean(credsSchool)}
          onClose={() => setCredsSchool(null)}
          schoolId={credsSchool.id}
          schoolName={credsSchool.name}
        />
      )}

      {/* ── Editing an offer, not a receipt ─────────────────────────── */}
      <Dialog
        open={!!editPkg}
        onClose={() => setEditPkg(null)}
        title="Edit package"
        description="Changes apply to packages sold from now on. Purchases already made keep the credits and the price they were sold at."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditPkg(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()}>Save package</Button>
          </div>
        }
      >
        {editPkg && (
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={editPkg.name}
                onChange={(e) => setEditPkg({ ...editPkg, name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Credits</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  value={editPkg.credits}
                  onChange={(e) =>
                    setEditPkg({ ...editPkg, credits: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={editPkg.price}
                  onChange={(e) => setEditPkg({ ...editPkg, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  className="mt-1"
                  value={editPkg.currency}
                  onChange={(e) =>
                    setEditPkg({ ...editPkg, currency: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!deletePkg}
        onClose={() => setDeletePkg(null)}
        title="Remove this package?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletePkg(null)}>
              Keep it
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-500"
              onClick={() => void removePackage()}
            >
              Remove package
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          <span className="font-semibold">{deletePkg?.name}</span> will no longer
          be offered to schools.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A package a school has already bought is kept and simply deactivated,
          so that school&apos;s purchase history still reads correctly. Credits
          already sold are never touched.
        </p>
      </Dialog>
    </div>
  );
}
