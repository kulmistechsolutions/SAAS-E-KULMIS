"use client";

import { useCallback, useEffect, useState } from "react";
import { buildSettingsSeed } from "@/lib/settings/seed";
import { getSettings, updateSettingsSection, useSettingsState } from "@/lib/settings/store";
import type { SettingsSectionKey, SettingsState } from "@/lib/settings/types";
import { toast } from "@/lib/toast";

export function useSettingsSection<K extends SettingsSectionKey>(key: K) {
  useSettingsState();
  const [draft, setDraft] = useState<SettingsState[K]>(() => getSettings()[key]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(getSettings()[key]);
    setDirty(false);
  }, [key]);

  const update = useCallback((patch: Partial<SettingsState[K]>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const cancel = useCallback(() => {
    setDraft(getSettings()[key]);
    setDirty(false);
  }, [key]);

  const resetToDefault = useCallback(() => {
    setDraft(buildSettingsSeed()[key]);
    setDirty(true);
  }, [key]);

  const save = useCallback(() => {
    setSaving(true);
    const result = updateSettingsSection(key, draft);
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Failed to save settings", "error");
      return false;
    }
    toast("Settings saved successfully.", "success");
    setDirty(false);
    return true;
  }, [key, draft]);

  return {
    draft,
    setDraft,
    update,
    dirty,
    setDirty,
    cancel,
    resetToDefault,
    save,
    saving,
  };
}
