"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiCreateSmsTemplate,
  apiDeleteSmsTemplate,
  apiUpdateSmsTemplate,
  type SmsCategory,
  type SmsTemplate,
} from "@/lib/sms/api";
import { toast } from "@/lib/toast";
import { CATEGORIES } from "./categories";

interface Props {
  templates: SmsTemplate[];
  onChanged: () => Promise<void> | void;
}

const EMPTY = { name: "", category: "CUSTOM" as SmsCategory, body: "" };

export function TemplateManager({ templates, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

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
      toast("Magaca iyo fariinta waa loo baahan yahay", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await apiCreateSmsTemplate(form);
        toast("Template waa la abuuray", "success");
      } else if (editingId) {
        await apiUpdateSmsTemplate(editingId, form);
        toast("Template waa la cusboonaysiiyay", "success");
      }
      cancel();
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Keydinta way fashilantay", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Ma hubtaa inaad tirtirto template-kan?")) return;
    try {
      await apiDeleteSmsTemplate(id);
      toast("Template waa la tirtiray", "success");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Tirtiridda way fashilantay", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Templates</h2>
        {editingId === null && (
          <Button className="h-8 px-3 text-xs" onClick={startCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Template cusub
          </Button>
        )}
      </div>

      {editingId !== null && (
        <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Magaca template-ka</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nooca</Label>
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
            <Label>Qoraalka fariinta</Label>
            <Textarea
              className="mt-1.5 min-h-[100px]"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="{{Magaca Waalidka}}, {{Magaca Ardayga}}, {{Magaca Dugsiga}}…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Isticmaal: {"{{Magaca Waalidka}}"}, {"{{Magaca Ardayga}}"},{" "}
              {"{{Fasalka}}"}, {"{{Lacagta Hadhaysa}}"}, {"{{Magaca Dugsiga}}"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="h-8 px-3 text-xs" onClick={() => void save()} disabled={saving}>
              {saving ? "Kaydinaya…" : "Kaydi"}
            </Button>
            <Button className="h-8 px-3 text-xs" variant="outline" onClick={cancel}>
              <X className="mr-1.5 h-4 w-4" /> Jooji
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
              Wali template ma jiro.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
