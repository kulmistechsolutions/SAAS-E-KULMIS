"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { announcementCategoryLabel, relativeTime } from "@/lib/parent-portal/format";
import type { PortalAnnouncement } from "@/lib/parent-portal/types";
import { apiCreateAnnouncement, fetchAnnouncements } from "@/lib/notifications/api";
import { apiSendAudienceSms } from "@/lib/sms/api";
import { useAuth } from "@/lib/auth";
import { useSettingsState } from "@/lib/settings/store";
import { toast } from "@/lib/toast";

const CATEGORIES: PortalAnnouncement["category"][] = [
  "GENERAL",
  "HOLIDAY",
  "EXAM",
  "MEETING",
  "EVENT",
  "FEE",
  "EMERGENCY",
];

type NotifyAudience = "ALL" | "PARENTS" | "TEACHERS" | "STUDENTS";

export default function AnnouncementsPage() {
  const t = useT();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const studentPortalEnabled = useSettingsState().students.portalLoginEnabled;
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<PortalAnnouncement[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PortalAnnouncement["category"]>("GENERAL");
  const [notifyAudience, setNotifyAudience] = useState<NotifyAudience>("ALL");
  const [pinned, setPinned] = useState(false);
  const [alsoSendSms, setAlsoSendSms] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    void fetchAnnouncements().then(setItems).catch(() => setItems([]));
    const params = new URLSearchParams(window.location.search);
    if (!isTeacher && params.get("compose") === "1") setComposeOpen(true);
  }, [mounted, isTeacher]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }),
    [items],
  );

  function resetForm() {
    setTitle("");
    setBody("");
    setCategory("GENERAL");
    setNotifyAudience("ALL");
    setPinned(false);
    setAlsoSendSms(false);
  }

  const AUDIENCE_TOAST: Record<NotifyAudience, string> = {
    ALL: "Notice sent to everyone",
    PARENTS: "Notice sent to all parents",
    TEACHERS: "Notice sent to all teachers",
    STUDENTS: "Notice sent to all students",
  };

  /**
   * Fires the SMS(es) for the chosen audience. "Everyone" has no single
   * matching SmsAudience value on the backend, so it's two sends (parents,
   * then teachers) with the results combined into one report to the admin.
   * Students are portal-only — there is no student SMS audience, which is
   * why the SMS option is hidden for them rather than silently doing nothing.
   */
  async function sendSmsForAudience(smsBody: string): Promise<{
    sent: number;
    failed: number;
    creditsUsed: number;
  }> {
    const targets: ("ALL_PARENTS" | "TEACHERS")[] =
      notifyAudience === "ALL"
        ? ["ALL_PARENTS", "TEACHERS"]
        : notifyAudience === "PARENTS"
          ? ["ALL_PARENTS"]
          : notifyAudience === "TEACHERS"
            ? ["TEACHERS"]
            : [];
    if (targets.length === 0) return { sent: 0, failed: 0, creditsUsed: 0 };
    const results = await Promise.all(
      targets.map((audience) =>
        apiSendAudienceSms({ category: "ANNOUNCEMENT", body: smsBody, audience }),
      ),
    );
    return results.reduce(
      (acc, r) => ({
        sent: acc.sent + r.sent,
        failed: acc.failed + r.failed,
        creditsUsed: acc.creditsUsed + r.creditsUsed,
      }),
      { sent: 0, failed: 0, creditsUsed: 0 },
    );
  }

  async function handlePublish() {
    if (!title.trim() || !body.trim()) {
      toast("Title and message are required", "error");
      return;
    }
    setPublishing(true);
    try {
      await apiCreateAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience: category,
        pinned,
        notifyAudience,
      });
      const next = await fetchAnnouncements();
      setItems(next);
      toast(AUDIENCE_TOAST[notifyAudience], "success");

      if (alsoSendSms) {
        try {
          const r = await sendSmsForAudience(`${title.trim()}\n${body.trim()}`);
          toast(
            `SMS sent: ${r.sent}${r.failed > 0 ? `, failed: ${r.failed}` : ""} (${r.creditsUsed} credits used)`,
            r.failed > 0 ? "info" : "success",
          );
        } catch {
          toast(
            "Notice was sent, but the SMS could not be sent (check SMS credits/settings).",
            "error",
          );
        }
      }

      setComposeOpen(false);
      resetForm();
    } catch {
      toast("Could not publish notice", "error");
    } finally {
      setPublishing(false);
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("announcements.loadingAnnouncements")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isTeacher ? "Announcements" : "School Notices"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isTeacher
              ? "School announcements relevant to staff and teachers."
              : "Publish announcements to the parent portal and in-app notifications."}
          </p>
        </div>
        {!isTeacher && (
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("announcements.sendNotice")}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {sorted.map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">{a.title}</h2>
                  {a.pinned && <Badge tone="info">{t("announcements.pinned")}</Badge>}
                </div>
                <Badge tone="muted" className="mt-2">
                  {announcementCategoryLabel(a.category)}
                </Badge>
              </div>
              <time className="text-xs text-muted-foreground">
                {relativeTime(a.publishedAt)}
              </time>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
          </article>
        ))}
      </div>

      {!isTeacher && (
      <Dialog
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          resetForm();
        }}
        title={t("announcements.sendNotice")}
        description={t("announcements.parentsWillSeeThisInThe")}
        footer={
          <>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              {t("announcements.cancel")}
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish Notice"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="notice-title">{t("announcements.title")}</Label>
            <Input
              id="notice-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("announcements.eGParentTeacherMeeting")}
            />
          </div>
          <div>
            <Label htmlFor="notice-send-to">{t("announcements.sendTo")}</Label>
            <Select
              id="notice-send-to"
              value={notifyAudience}
              onChange={(e) => setNotifyAudience(e.target.value as NotifyAudience)}
            >
              <option value="ALL">{t("announcements.everyone")}</option>
              <option value="PARENTS">{t("announcements.parentsOnly")}</option>
              <option value="TEACHERS">{t("announcements.teachersOnly")}</option>
              {/* Students read notices in their own portal, so offering this
                  before the school has switched that portal on would send a
                  notice nobody can open. */}
              {studentPortalEnabled && (
                <option value="STUDENTS">{t("announcements.studentsOnly")}</option>
              )}
            </Select>
          </div>
          <div>
            <Label htmlFor="notice-category">{t("announcements.category")}</Label>
            <Select
              id="notice-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as PortalAnnouncement["category"])
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {announcementCategoryLabel(c)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="notice-body">{t("announcements.message")}</Label>
            <Textarea
              id="notice-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("announcements.writeTheAnnouncementForParents")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            {t("announcements.pinToTopOfParentPortal")}
          </label>
          {/* No student SMS audience exists — a notice to students lands in
              their portal only, so the option is hidden rather than offered
              and silently ignored. */}
          {notifyAudience !== "STUDENTS" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alsoSendSms}
                  onChange={(e) => setAlsoSendSms(e.target.checked)}
                />
                {t("announcements.alsoSendViaSms")}
              </label>
              {alsoSendSms && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("announcements.smsUsesCreditsWarning")}
                </p>
              )}
            </>
          )}
        </div>
      </Dialog>
      )}
    </div>
  );
}
