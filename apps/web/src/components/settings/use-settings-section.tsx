"use client";

import { useCallback, useEffect, useState } from "react";
import { buildSettingsSeed } from "@/lib/settings/seed";
import { getSettings, updateSettingsSection, useSettingsState } from "@/lib/settings/store";
import type { SettingsSectionKey, SettingsState } from "@/lib/settings/types";
import { toast } from "@/lib/toast";

export function useSettingsSection<K extends SettingsSectionKey>(key: K) {
  const globalState = useSettingsState();
  const [draft, setDraft] = useState<SettingsState[K]>(() => getSettings()[key]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(getSettings()[key]);
    setDirty(false);
  }, [key]);

  // The initial mount above can run before refreshSettings() resolves (it's
  // fire-and-forget), so `draft` is frequently frozen on seed defaults even
  // once the real data has loaded. Keep following the store until the user
  // actually starts editing — a save's own optimistic update also arrives
  // through this same path, so it doesn't need separate handling.
  useEffect(() => {
    if (!dirty) setDraft(globalState[key]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalState, key]);

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

  const save = useCallback(async () => {
    setSaving(true);
    const result = await updateSettingsSection(key, draft);
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
