"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SenderIdReview } from "@/components/platform/sender-id-review";
import { GatewayCredentialsDialog } from "@/components/platform/gateway-credentials-dialog";
import {
  adjustPlatformSmsCredits,
  assignPlatformSmsPackage,
  createPlatformSmsPackage,
  fetchPlatformSmsGatewayLicenses,
  fetchPlatformSmsMessages,
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
  const [messages, setMessages] = useState<
    Awaited<ReturnType<typeof fetchPlatformSmsMessages>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "packages" | "assign" | "gateways" | "sender-ids" | "logs"
  >("packages");

  const [pkgName, setPkgName] = useState("");
  const [pkgCredits, setPkgCredits] = useState("100");
  const [pkgPrice, setPkgPrice] = useState("10");
  const [pkgDesc, setPkgDesc] = useState("");

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
      setMessages(msgs);
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
        <div className="flex gap-2">
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
                </li>
              ))}
              {data.packages.length === 0 && (
                <p className="text-sm text-slate-500">{t("platformSms.noPackagesYet")}</p>
              )}
            </ul>
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
      )}

      {credsSchool && (
        <GatewayCredentialsDialog
          open={Boolean(credsSchool)}
          onClose={() => setCredsSchool(null)}
          schoolId={credsSchool.id}
          schoolName={credsSchool.name}
        />
      )}
    </div>
  );
}
