"use client";

import { useT } from "@/lib/i18n/provider";
import { NamedListManager } from "@/components/settings/named-list-manager";
import {
  apiCreateVillage,
  apiDeleteVillage,
  apiListVillages,
  apiUpdateVillage,
} from "@/lib/villages/api";
import { refreshVillages } from "@/lib/villages/store";

/**
 * A school's own neighborhood list, offered as an optional field on student
 * registration. General-purpose — every school gets this page, independent
 * of whether it uses a custom academic structure.
 */
export default function VillagesSettingsPage() {
  const t = useT();
  return (
    <NamedListManager
      title={t("settingsVillages.title")}
      subtitle={t("settingsVillages.subtitle")}
      namePlaceholder={t("settingsVillages.namePlaceholder")}
      addLabel={t("settingsVillages.add")}
      addFailedMessage={t("settingsVillages.addFailed")}
      renameFailedMessage={t("settingsVillages.renameFailed")}
      reorderFailedMessage={t("settingsVillages.reorderFailed")}
      deleteFailedMessage={t("settingsVillages.deleteFailed")}
      deleteConfirmMessage={t("settingsVillages.deleteConfirm")}
      emptyMessage={t("settingsVillages.noneYet")}
      list={apiListVillages}
      create={apiCreateVillage}
      update={apiUpdateVillage}
      remove={apiDeleteVillage}
      onChanged={refreshVillages}
    />
  );
}
