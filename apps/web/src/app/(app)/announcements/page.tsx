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
import { useAuth } from "@/lib/auth";
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

type NotifyAudience = "ALL" | "PARENTS" | "TEACHERS";

export default function AnnouncementsPage() {
  const t = useT();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<PortalAnnouncement[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PortalAnnouncement["category"]>("GENERAL");
  const [notifyAudience, setNotifyAudience] = useState<NotifyAudience>("ALL");
  const [pinned, setPinned] = useState(false);
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
  }

  const AUDIENCE_TOAST: Record<NotifyAudience, string> = {
    ALL: "Notice sent to everyone",
    PARENTS: "Notice sent to all parents",
    TEACHERS: "Notice sent to all teachers",
  };

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
        </div>
      </Dialog>
      )}
    </div>
  );
}
