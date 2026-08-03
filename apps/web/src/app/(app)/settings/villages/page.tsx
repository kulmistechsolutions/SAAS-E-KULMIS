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
import {
  apiCreateDistrict,
  apiDeleteDistrict,
  apiListDistricts,
  apiUpdateDistrict,
} from "@/lib/districts/api";
import { refreshDistricts } from "@/lib/districts/store";

/**
 * Villages and Districts are both school-defined name lists offered on the
 * student registration form (Village on both templates, District on the
 * traditional one) — shown together on one page since they're filled in
 * side by side on that form, same as Class and Section are.
 */
export default function VillagesSettingsPage() {
  const t = useT();
  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
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
      </div>
    </div>
  );
}
