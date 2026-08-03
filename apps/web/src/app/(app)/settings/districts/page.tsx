"use client";

import { useT } from "@/lib/i18n/provider";
import { NamedListManager } from "@/components/settings/named-list-manager";
import {
  apiCreateDistrict,
  apiDeleteDistrict,
  apiListDistricts,
  apiUpdateDistrict,
} from "@/lib/districts/api";
import { refreshDistricts } from "@/lib/districts/store";

/**
 * A school's own district list, offered on the DETAILED registration form
 * (see School.studentFormTemplate). Mirrors the Villages settings page.
 */
export default function DistrictsSettingsPage() {
  const t = useT();
  return (
    <NamedListManager
      title={t("settingsDistricts.title")}
      subtitle={t("settingsDistricts.subtitle")}
      namePlaceholder={t("settingsDistricts.namePlaceholder")}
      addLabel={t("settingsDistricts.add")}
      addFailedMessage={t("settingsDistricts.addFailed")}
      renameFailedMessage={t("settingsDistricts.renameFailed")}
      reorderFailedMessage={t("settingsDistricts.reorderFailed")}
      deleteFailedMessage={t("settingsDistricts.deleteFailed")}
      deleteConfirmMessage={t("settingsDistricts.deleteConfirm")}
      emptyMessage={t("settingsDistricts.noneYet")}
      list={apiListDistricts}
      create={apiCreateDistrict}
      update={apiUpdateDistrict}
      remove={apiDeleteDistrict}
      onChanged={refreshDistricts}
    />
  );
}
