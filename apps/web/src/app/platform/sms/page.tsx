"use client";

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
import {
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
  const [data, setData] = useState<PlatformSmsOverview | null>(null);
  const [messages, setMessages] = useState<
    Awaited<ReturnType<typeof fetchPlatformSmsMessages>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "packages" | "assign" | "gateways" | "logs"
  >("packages");

  const [pkgName, setPkgName] = useState("");
  const [pkgCredits, setPkgCredits] = useState("100");
  const [pkgPrice, setPkgPrice] = useState("10");
  const [pkgDesc, setPkgDesc] = useState("");

  const [assignSchool, setAssignSchool] = useState("");
  const [assignPkg, setAssignPkg] = useState("");

  const [gwLicenses, setGwLicenses] = useState<PlatformSmsGatewayLicense[]>([]);
  const [gwSchool, setGwSchool] = useState("");
  const [gwMonths, setGwMonths] = useState(12);
  const [gwPrice, setGwPrice] = useState("");
  const [gwNote, setGwNote] = useState("");

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
      toast(e instanceof Error ? e.message : "Failed to load SMS data", "error");
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
    if (!confirm("Revoke this licence? The school falls back to platform credits."))
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

  if (loading && !data) {
    return <p className="text-slate-400">Loading SMS packages…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <MessageSquare className="h-6 w-6 text-violet-400" />
            SMS Packages
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Create packages and assign credits to schools after Hormuud is verified.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/platform/sms/settings"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm text-slate-200 hover:bg-white/5"
          >
            <Settings2 className="h-4 w-4" />
            SMS Settings
          </Link>
          <Button
            variant="outline"
            onClick={() => void load()}
            className="border-white/20 text-slate-200"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {!unlocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Packages locked</p>
            <p className="mt-0.5 text-amber-100/80">
              Status: {data?.config.connectionStatus ?? "DISCONNECTED"}
              {data?.config.connectionMessage
                ? ` — ${data.config.connectionMessage}`
                : ""}
              .{" "}
              <Link href="/platform/sms/settings" className="underline">
                Open SMS Settings
              </Link>{" "}
              and run Test Connection & Save first.
            </p>
          </div>
        </div>
      )}

      {unlocked && data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
            <p className="text-xs text-slate-500">Connection</p>
            <p className="font-semibold text-emerald-300">
              {data.config.connectionStatus}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
            <p className="text-xs text-slate-500">Provider balance</p>
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
            <h2 className="font-semibold text-white">Create package</h2>
            {!unlocked && (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Locked until connection verified
              </p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-slate-400">Name</Label>
                <Input
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  disabled={!unlocked}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Credits</Label>
                  <Input
                    type="number"
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={pkgCredits}
                    onChange={(e) => setPkgCredits(e.target.value)}
                    disabled={!unlocked}
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Price</Label>
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
                <Label className="text-slate-400">Description</Label>
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
                <Plus className="mr-2 h-4 w-4" /> Create
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">Packages</h2>
            <ul className="mt-3 space-y-2">
              {data.packages.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.credits} credits · {p.currency} {String(p.price)}
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
                <p className="text-sm text-slate-500">No packages yet.</p>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === "assign" && data && (
        <div className="max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] p-5">
          <h2 className="font-semibold text-white">Assign package to school</h2>
          {!unlocked && (
            <p className="mt-2 text-sm text-amber-300">
              Assignment is locked until Hormuud is verified.
            </p>
          )}
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-slate-400">School</Label>
              <Select
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={assignSchool}
                onChange={(e) => setAssignSchool(e.target.value)}
                disabled={!unlocked}
              >
                {data.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.creditsRemaining} left)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Package</Label>
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
                      {p.name} — {p.credits} credits
                    </option>
                  ))}
              </Select>
            </div>
            <Button
              onClick={() => void assign()}
              disabled={!unlocked || !assignSchool || !assignPkg}
            >
              Assign package
            </Button>
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-300">Recent purchases</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {data.recentPurchases.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-white/5 px-3 py-2 text-slate-400"
                >
                  <span className="text-white">{p.school.name}</span> bought{" "}
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
              Sell &quot;use your own SMS account&quot;
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Lets a school connect its own Hormuud credentials. Their SMS is
              then billed by Hormuud directly and stops consuming platform
              credits, for as long as the licence runs.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-slate-400">School</Label>
                <Select
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={gwSchool}
                  onChange={(e) => setGwSchool(e.target.value)}
                >
                  <option value="">Select a school…</option>
                  {data.schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Duration</Label>
                  <Select
                    className="mt-1 border-white/10 bg-[#0b1120] text-white"
                    value={String(gwMonths)}
                    onChange={(e) => setGwMonths(Number(e.target.value))}
                  >
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months (yearly)</option>
                    <option value="24">24 months</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Price (optional)</Label>
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
                <Label className="text-slate-400">Note (optional)</Label>
                <Input
                  className="mt-1 border-white/10 bg-[#0b1120] text-white"
                  value={gwNote}
                  onChange={(e) => setGwNote(e.target.value)}
                />
              </div>
              <Button onClick={() => void grantGateway()} disabled={!gwSchool}>
                Activate for this school
              </Button>
              <p className="text-xs text-slate-500">
                Renewing a school that still has time left extends from its
                current expiry, so nothing already paid for is lost.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h3 className="text-sm font-medium text-slate-300">Licences</h3>
            {gwLicenses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No school is using its own gateway yet.
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
                        {l.durationMonths} month(s) ·{" "}
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
                        <button
                          type="button"
                          onClick={() => void revokeGateway(l.id)}
                          className="text-xs text-rose-300 hover:text-rose-200"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Sender</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">When</th>
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
                    No messages logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
