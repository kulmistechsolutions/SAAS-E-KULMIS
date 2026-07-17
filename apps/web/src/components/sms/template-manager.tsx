"use client";

import { useRef, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiCreateSmsTemplate,
  apiDeleteSmsTemplate,
  apiResetSmsTemplates,
  apiUpdateSmsTemplate,
  type SmsCategory,
  type SmsTemplate,
} from "@/lib/sms/api";
import { toast } from "@/lib/toast";
import { CATEGORIES } from "./categories";
import { VariablePicker, VariableWarning } from "./variables";

interface Props {
  templates: SmsTemplate[];
  onChanged: () => Promise<void> | void;
}

const EMPTY = { name: "", category: "CUSTOM" as SmsCategory, body: "" };

export function TemplateManager({ templates, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function startCreate() {
    setForm(EMPTY);
    setEditingId("new");
  }

  function startEdit(t: SmsTemplate) {
    setForm({ name: t.name, category: t.category, body: t.body });
    setEditingId(t.id);
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      toast("Name and message are required", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await apiCreateSmsTemplate(form);
        toast("Template created", "success");
      } else if (editingId) {
        await apiUpdateSmsTemplate(editingId, form);
        toast("Template updated", "success");
      }
      cancel();
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await apiDeleteSmsTemplate(id);
      toast("Template deleted", "success");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  async function resetToDefaults() {
    if (
      !confirm(
        "This deletes ALL your current templates (including any you customized) and replaces them with the built-in Somali defaults. Continue?",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await apiResetSmsTemplates();
      toast("Templates reset to the built-in defaults", "success");
      cancel();
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Templates</h2>
          <p className="text-xs text-muted-foreground">
            Built-in defaults are in Somali. Select one when composing to send that wording.
          </p>
        </div>
        {editingId === null && (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => void resetToDefaults()}
              disabled={resetting}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {resetting ? "Resetting…" : "Reset to Somali defaults"}
            </Button>
            <Button className="h-8 px-3 text-xs" onClick={startCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> New template
            </Button>
          </div>
        )}
      </div>

      {editingId !== null && (
        <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Template name</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                className="mt-1.5"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as SmsCategory }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Message body</Label>
            <div className="mt-1.5 space-y-2">
              <VariablePicker
                targetRef={bodyRef}
                value={form.body}
                onChange={(body) => setForm((f) => ({ ...f, body }))}
              />
              <Textarea
                ref={bodyRef}
                className="min-h-[100px]"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your message, and click a variable above to insert it…"
              />
            </div>
            <VariableWarning body={form.body} />
          </div>
          <div className="flex gap-2">
            <Button className="h-8 px-3 text-xs" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button className="h-8 px-3 text-xs" variant="outline" onClick={cancel}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <ul className="divide-y">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.name}</p>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(t.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {templates.length === 0 && (
            <li className="px-5 py-8 text-center text-muted-foreground">
              No templates yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
