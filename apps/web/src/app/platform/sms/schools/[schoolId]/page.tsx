"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  KeyRound,
  PlugZap,
  RefreshCw,
  Signature,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  assignPlatformSenderId,
  fetchPlatformSchoolGateway,
  fetchPlatformSmsOverview,
  grantPlatformSmsGatewayLicense,
  revokePlatformSmsGatewayLicense,
  testPlatformSchoolGateway,
  togglePlatformSchoolGateway,
  updateSchoolSmsGovernance,
  type PlatformSchoolGateway,
  type PlatformSmsOverview,
} from "@/lib/platform/api";

/**
 * Everything the platform owner does to one school's SMS, on one page.
 *
 * These four jobs — give it a sending name, connect it to a provider of its
 * own, cap it, suspend it — were spread over three screens and a dialog, and
 * doing all four for a new school meant visiting each in turn and remembering
 * which school you were on. They belong together because they are one decision:
 * how this school sends.
 *
 * The school itself sees none of it. It reads its account number, its sending
 * name and its balance, and that is all.
 */

type School = PlatformSmsOverview["schools"][number];

export default function PlatformSchoolSmsPage() {
  const params = useParams<{ schoolId: string }>();
  const schoolId = params.schoolId;

  const [school, setSchool] = useState<School | null>(null);
  const [gateway, setGateway] = useState<PlatformSchoolGateway | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, gw] = await Promise.all([
        fetchPlatformSmsOverview(),
        fetchPlatformSchoolGateway(schoolId).catch(() => null),
      ]);
      setSchool(overview.schools.find((s) => s.id === schoolId) ?? null);
      setGateway(gw);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load school", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !school) {
    return <p className="text-slate-400">Loading...</p>;
  }
  if (!school) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/sms/schools"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> School accounts
        </Link>
        <p className="text-slate-400">That school is not on the list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/platform/sms/schools"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> School accounts
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-white">{school.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
            <span className="font-mono">{school.accountNo}</span>
            <span>{school.subdomain}</span>
            <span>{school.creditsRemaining.toLocaleString()} credits</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          className="border-white/20 text-slate-200"
        >
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SenderIdCard school={school} onSaved={load} />
        <GovernanceCard school={school} onSaved={load} />
      </div>

      <LicenceCard school={school} gateway={gateway} onSaved={load} />
      {gateway && (
        <GatewayCard schoolId={schoolId} gateway={gateway} onSaved={load} />
      )}
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  note,
  children,
}: {
  title: string;
  icon: typeof Signature;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Icon className="h-4 w-4 text-violet-400" />
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-slate-400">{note}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** The name recipients see. Registered with the operator, granted here. */
function SenderIdCard({
  school,
  onSaved,
}: {
  school: School;
  onSaved: () => void;
}) {
  const [name, setName] = useState(school.smsSenderName ?? "");
  const [testPhone, setTestPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!testPhone.trim()) {
      toast("A test number is required — one real message goes first.", "error");
      return;
    }
    setSaving(true);
    try {
      await assignPlatformSenderId(school.id, {
        approvedName: name.trim(),
        testPhone: testPhone.trim(),
      });
      toast(`Sending name set to "${name.trim()}"`, "success");
      setTestPhone("");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not set the name", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Sender ID"
      icon={Signature}
      note="The name on every message this school sends."
    >
      <div className="space-y-3">
        <div>
          <Label className="text-slate-400">Sending name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={11}
            placeholder="KTS SCHOOL"
            className="mt-1 border-white/10 bg-[#0b1120] text-white"
          />
          <p className="mt-1 text-xs text-slate-500">
            Up to 11 characters. Currently{" "}
            <span className="text-slate-300">
              {school.smsSenderName || "not set — messages go under the gateway default"}
            </span>
            .
          </p>
        </div>
        <div>
          <Label className="text-slate-400">Test number</Label>
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="252XXXXXXXXX"
            className="mt-1 border-white/10 bg-[#0b1120] text-white"
          />
          <p className="mt-1 text-xs text-slate-500">
            {/* This is the whole safeguard. Our own records saying a name is
                registered has no bearing on whether the operator agrees. */}
            One real message is sent under this name before anything is saved.
            If the operator has not registered it, nothing changes.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving || !name.trim()}>
          {saving ? "Testing and saving..." : "Set sending name"}
        </Button>
      </div>
    </Card>
  );
}

/** Suspension and ceilings — the two things a school cannot touch. */
function GovernanceCard({
  school,
  onSaved,
}: {
  school: School;
  onSaved: () => void;
}) {
  const [suspended, setSuspended] = useState(school.smsSuspended);
  const [reason, setReason] = useState(school.smsSuspendedReason ?? "");
  const [daily, setDaily] = useState(String(school.smsDailyLimit));
  const [monthly, setMonthly] = useState(String(school.smsMonthlyLimit));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateSchoolSmsGovernance(school.id, {
        smsSuspended: suspended,
        smsSuspendedReason: suspended ? reason.trim() || null : null,
        smsDailyLimit: Math.max(0, Number(daily) || 0),
        smsMonthlyLimit: Math.max(0, Number(monthly) || 0),
      });
      toast("Saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Limits and suspension"
      icon={SlidersHorizontal}
      note="The school cannot change either of these itself."
    >
      <div className="space-y-3">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={suspended}
            onChange={(e) => setSuspended(e.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-white">
              <Ban className="h-3.5 w-3.5" /> Suspend SMS sending
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              History and reports stay readable.
            </span>
          </span>
        </label>
        {suspended && (
          <div>
            <Label className="text-slate-400">Reason shown to the school</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Account configuration issue"
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-400">Daily limit</Label>
            <Input
              type="number"
              min={0}
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
          <div>
            <Label className="text-slate-400">Monthly limit</Label>
            <Input
              type="number"
              min={0}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Counted in credits. 0 means no limit.
        </p>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}

/** Whether this school is allowed a provider account of its own at all. */
function LicenceCard({
  school,
  gateway,
  onSaved,
}: {
  school: School;
  gateway: PlatformSchoolGateway | null;
  onSaved: () => void;
}) {
  const [months, setMonths] = useState("12");
  const [busy, setBusy] = useState(false);

  async function grant() {
    setBusy(true);
    try {
      await grantPlatformSmsGatewayLicense({
        schoolId: school.id,
        durationMonths: Math.max(1, Number(months) || 12),
      });
      toast("Own-provider licence granted", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not grant", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!gateway?.license) return;
    setBusy(true);
    try {
      await revokePlatformSmsGatewayLicense(gateway.license.id);
      toast("Licence revoked", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not revoke", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Own provider account"
      icon={KeyRound}
      note="Whether this school sends through its own provider account instead of the platform's credits."
    >
      {gateway?.licensed ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Licensed
          </span>
          {gateway.license && (
            <span className="text-xs text-slate-400">
              until {new Date(gateway.license.endDate).toLocaleDateString()}
            </span>
          )}
          <Button
            variant="outline"
            className="ms-auto border-white/20 text-slate-200"
            onClick={() => void revoke()}
            disabled={busy}
          >
            Revoke
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-slate-400">Months</Label>
            <Input
              type="number"
              min={1}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="mt-1 w-28 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
          <Button onClick={() => void grant()} disabled={busy}>
            Grant licence
          </Button>
          <p className="text-xs text-slate-500">
            Until this is granted, the school sends on platform credits.
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * The school's own provider credentials.
 *
 * Entered here and nowhere else. The school's own SMS page can see that a
 * connection exists and whether it is working; it has no route that writes a
 * key, a secret or an endpoint.
 */
function GatewayCard({
  schoolId,
  gateway,
  onSaved,
}: {
  schoolId: string;
  gateway: PlatformSchoolGateway;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState(gateway.provider);
  const [baseUrl, setBaseUrl] = useState(gateway.baseUrl);
  const [username, setUsername] = useState(gateway.username);
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [senderId, setSenderId] = useState(gateway.senderId ?? "");
  const [busy, setBusy] = useState(false);

  async function testAndSave() {
    setBusy(true);
    try {
      const res = await testPlatformSchoolGateway(schoolId, {
        provider,
        baseUrl: baseUrl.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
        apiToken: apiToken || undefined,
        senderId: senderId.trim() || null,
      });
      if (res.test.ok) {
        toast(`Connected. ${res.test.message}`, "success");
        setPassword("");
        setApiToken("");
      } else {
        toast(res.test.message || "Connection failed", "error");
      }
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not test", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await togglePlatformSchoolGateway(schoolId, enabled);
      toast(enabled ? "Own gateway switched on" : "Own gateway switched off", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not switch", "error");
    } finally {
      setBusy(false);
    }
  }

  const isDhambaal = provider === "DHAMBAAL";
  // Credentials cannot be saved until the school is licensed for its own
  // account, so the fields are shown and locked rather than hidden: a page
  // that mentions credentials nowhere does not tell you they are step two.
  const locked = !gateway.licensed;

  return (
    <Card
      title="Provider connection"
      icon={PlugZap}
      note="This school's own API account. Entered here and nowhere else — the school can see that it is connected, never the credentials."
    >
      {locked && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Grant the licence above first. Until then this school sends on
          platform credits, and these fields cannot be saved.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            gateway.active
              ? "bg-emerald-500/15 text-emerald-300"
              : gateway.connectionStatus === "ERROR"
                ? "bg-rose-500/15 text-rose-300"
                : "bg-white/5 text-slate-400"
          }`}
        >
          {gateway.active ? "Live" : gateway.connectionStatus}
        </span>
        {gateway.connectionMessage && (
          <span className="text-xs text-slate-400">{gateway.connectionMessage}</span>
        )}
        {gateway.providerBalance && (
          <span className="text-xs text-slate-400">
            Provider balance {gateway.providerBalance}
          </span>
        )}
        <Button
          variant="outline"
          className="ms-auto border-white/20 text-slate-200"
          onClick={() => void toggle(!gateway.enabled)}
          disabled={busy || locked || !gateway.connectionVerified}
        >
          {gateway.enabled ? "Switch off" : "Switch on"}
        </Button>
      </div>

      <fieldset disabled={locked} className={locked ? "opacity-50" : ""}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-slate-400">Provider</Label>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "HORMUUD" | "DHAMBAAL")}
            className="mt-1 border-white/10 bg-[#0b1120] text-white"
          >
            <option value="HORMUUD">Hormuud</option>
            <option value="DHAMBAAL">Dhambaal</option>
          </Select>
        </div>
        <div>
          <Label className="text-slate-400">API URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 border-white/10 bg-[#0b1120] text-white"
          />
        </div>
        {isDhambaal ? (
          <div className="sm:col-span-2">
            <Label className="text-slate-400">API token</Label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={gateway.hasApiToken ? "Stored - leave blank to keep" : ""}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
        ) : (
          <>
            <div>
              <Label className="text-slate-400">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">API password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={gateway.hasPassword ? "Stored - leave blank to keep" : ""}
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <Label className="text-slate-400">Gateway sender ID</Label>
          <Input
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            placeholder="Leave blank to use the school's sending name"
            className="mt-1 border-white/10 bg-[#0b1120] text-white"
          />
        </div>
      </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void testAndSave()} disabled={busy || locked}>
          {busy ? "Testing..." : "Test and save"}
        </Button>
        <p className="text-xs text-slate-500">
          {/* Saving credentials that have never answered leaves a school looking
              connected and sending nothing. */}
          Saved only if the connection answers.
        </p>
      </div>
    </Card>
  );
}
