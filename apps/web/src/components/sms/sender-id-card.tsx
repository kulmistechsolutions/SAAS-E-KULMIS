"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Clock,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiRequestSmsSenderId,
  apiSmsSenderId,
  type SmsSenderIdState,
} from "@/lib/sms/api";
import { toast } from "@/lib/toast";

const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Read a picked file as base64 (without the data: prefix) plus its mime. */
function readFile(
  file: File,
): Promise<{ base64: string; name: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.slice(result.indexOf(",") + 1);
      resolve({ base64, name: file.name, mime: file.type });
    };
    reader.readAsDataURL(file);
  });
}

function shortDate(iso: string | null): string {
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
 * The school's sending name: what it is, or how to apply for one.
 *
 * The name on an SMS is registered with the mobile operator against a licensed
 * organisation, so a school cannot simply type it — it applies with the name it
 * wants and its registration document, and the platform owner grants it.
 */
export function SenderIdCard() {
  const t = useT();
  const [state, setState] = useState<SmsSenderIdState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [person, setPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [doc, setDoc] = useState<{
    base64: string;
    name: string;
    mime: string;
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void apiSmsSenderId()
      .then(setState)
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : "Could not load", "error"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function onPickFile(file: File | null) {
    if (!file) return setDoc(null);
    if (file.size > MAX_DOC_BYTES) {
      toast("The document must be under 5 MB.", "error");
      return;
    }
    try {
      setDoc(await readFile(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read file", "error");
    }
  }

  async function submit() {
    if (name.trim().length < 3) {
      toast("Enter the name you want, at least 3 characters.", "error");
      return;
    }
    setBusy(true);
    try {
      await apiRequestSmsSenderId({
        requestedName: name.trim(),
        contactPerson: person.trim() || null,
        contactPhone: phone.trim() || null,
        note: note.trim() || null,
        licenseDoc: doc?.base64 ?? null,
        licenseDocName: doc?.name ?? null,
        licenseDocMime: doc?.mime ?? null,
      });
      toast(
        "Application sent. You'll see the name here once it's approved.",
        "success",
      );
      setShowForm(false);
      setName("");
      setPerson("");
      setPhone("");
      setNote("");
      setDoc(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not apply", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("smsSenderIdCard.loadingSenderName")}
        </p>
      </div>
    );
  }

  // The feature is switched off platform-wide. Schools see nothing at all
  // rather than an application they cannot use — messages go out under the
  // name the gateway is configured with.
  if (state?.available === false) return null;

  const rejected = state?.history.find((h) => h.status === "REJECTED");
  const showRejection =
    rejected && !state?.activeSenderId && !state?.pending ? rejected : null;

  return (
    <div className="space-y-4">
      {/* What this is */}
      <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1.5">
          <p className="font-semibold">
            {t("smsSenderIdCard.theNameParentsSeeWhenYour")}
          </p>
          <p>
            {t("smsSenderIdCard.insteadOfAPhoneNumberYour")}{" "}
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs dark:bg-black/30">
              {t("smsSenderIdCard.alNuur")}
            </span>{" "}
            {t("smsSenderIdCard.or")}{" "}
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs dark:bg-black/30">
              {t("smsSenderIdCard.siraaji")}
            </span>
            .
          </p>
          <p>
            {t("smsSenderIdCard.theMobileOperatorRegistersThatName")}
          </p>
          <p className="text-xs opacity-90">
            {t("smsSenderIdCard.upTo11CharactersLettersDigits")}
          </p>
        </div>
      </div>

      {/* Current state */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        {state?.activeSenderId ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("smsSenderIdCard.approvedSenderName")}
              </p>
              <p className="text-xl font-bold text-emerald-600">
                {state.activeSenderId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("smsSenderIdCard.everySmsYouSendArrivesFrom")}
              </p>
            </div>
          </div>
        ) : state?.pending ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{t("smsSenderIdCard.awaitingApproval")}</p>
              <p className="text-xl font-bold">{state.pending.requestedName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("smsSenderIdCard.applied")} {shortDate(state.pending.createdAt)}
                {state.pending.licenseDocName
                  ? ` · licence attached (${state.pending.licenseDocName})`
                  : " · no licence attached"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CircleAlert className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("smsSenderIdCard.noSenderNameYet")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("smsSenderIdCard.untilOneIsApprovedMessagesGo")}
                </p>
              </div>
            </div>

            {showRejection && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                <p className="font-medium">
                  {t("smsSenderIdCard.yourLastApplication")}{showRejection.requestedName}{t("smsSenderIdCard.wasNotApproved")}
                </p>
                {showRejection.reviewNote && (
                  <p className="mt-1">{showRejection.reviewNote}</p>
                )}
                <p className="mt-1 text-xs opacity-80">
                  {t("smsSenderIdCard.correctItAndApplyAgain")}
                </p>
              </div>
            )}

            {!showForm ? (
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                {t("smsSenderIdCard.applyForASenderName")}
              </Button>
            ) : (
              <div className="mt-4 max-w-md space-y-3">
                <div>
                  <Label>{t("smsSenderIdCard.nameYouWant")}</Label>
                  <Input
                    className="mt-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("smsSenderIdCard.alNuur")}
                    maxLength={11}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {name.trim().length}{t("smsSenderIdCard.n11Characters")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("smsSenderIdCard.contactPerson")}</Label>
                    <Input
                      className="mt-1.5"
                      value={person}
                      onChange={(e) => setPerson(e.target.value)}
                      placeholder={t("smsSenderIdCard.headteacherSName")}
                    />
                  </div>
                  <div>
                    <Label>{t("smsSenderIdCard.contactPhone")}</Label>
                    <Input
                      className="mt-1.5"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+252 61 …"
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("smsSenderIdCard.schoolLicenceRegistration")}</Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary">
                      <Upload className="h-4 w-4" />
                      {doc ? "Change file" : "Choose file"}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) =>
                          void onPickFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <span className="truncate text-xs text-muted-foreground">
                      {doc ? doc.name : "PDF or photo, under 5 MB"}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>{t("smsSenderIdCard.anythingElseOptional")}</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("smsSenderIdCard.whatTheNameStandsForIf")}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setShowForm(false)}
                  >
                    {t("smsSenderIdCard.cancel")}
                  </Button>
                  <Button disabled={busy} onClick={() => void submit()}>
                    {busy ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        {t("smsSenderIdCard.sending")}
                      </>
                    ) : (
                      "Send application"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* History */}
      {state && state.history.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-5 py-3 text-sm font-semibold">
            {t("smsSenderIdCard.applicationHistory")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-secondary/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("smsSenderIdCard.applied")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("smsSenderIdCard.name")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("smsSenderIdCard.result")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("smsSenderIdCard.note")}</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {shortDate(h.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {h.approvedName ?? h.requestedName}
                      {h.approvedName && h.approvedName !== h.requestedName && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          {t("smsSenderIdCard.askedFor")} {h.requestedName})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : h.status === "REJECTED"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {h.status === "APPROVED"
                          ? "Approved"
                          : h.status === "REJECTED"
                            ? "Not approved"
                            : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {h.reviewNote ?? "—"}
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
