"use client";

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

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<PortalAnnouncement[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PortalAnnouncement["category"]>("GENERAL");
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
    () => [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [items],
  );

  function resetForm() {
    setTitle("");
    setBody("");
    setCategory("GENERAL");
    setPinned(false);
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
      });
      const next = await fetchAnnouncements();
      setItems(next);
      toast("Notice sent to all parents", "success");
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
        Loading announcements…
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
            <Plus className="mr-2 h-4 w-4" />
            Send Notice
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
                  {a.pinned && <Badge tone="info">Pinned</Badge>}
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
        title="Send Notice"
        description="Parents will see this in the portal and receive an in-app notification."
        footer={
          <>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish Notice"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parent-Teacher Meeting"
            />
          </div>
          <div>
            <Label htmlFor="notice-category">Category</Label>
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
            <Label htmlFor="notice-body">Message</Label>
            <Textarea
              id="notice-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the announcement for parents…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin to top of parent portal
          </label>
        </div>
      </Dialog>
      )}
    </div>
  );
}
