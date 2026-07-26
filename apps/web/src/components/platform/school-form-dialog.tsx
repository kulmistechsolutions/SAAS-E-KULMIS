"use client";


import { useT } from "@/lib/i18n/provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSchoolSchema, type CreateSchoolInput } from "@ekulmis/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateSchoolInput) => Promise<void>;
}

export function SchoolFormDialog({ open, onClose, onSubmit }: Props) {
  const t = useT();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSchoolInput>({ resolver: zodResolver(createSchoolSchema) });

  async function submit(values: CreateSchoolInput) {
    await onSubmit(values);
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("platformSchoolFormDialog.provisionNewSchool")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("platformSchoolFormDialog.cancel")}
          </Button>
          <Button type="submit" form="platform-school-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create School"}
          </Button>
        </>
      }
    >
      <form id="platform-school-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <div>
          <Label>{t("platformSchoolFormDialog.schoolName")}</Label>
          <Input {...register("name")} placeholder={t("platformSchoolFormDialog.alNoorInternationalSchool")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <Label>{t("platformSchoolFormDialog.subdomain")}</Label>
          <Input {...register("subdomain")} placeholder={t("platformSchoolFormDialog.alnoor")} />
          <p className="mt-1 text-xs text-muted-foreground">{t("platformSchoolFormDialog.lowercaseLettersNumbersHyphensOnly")}</p>
          {errors.subdomain && <p className="mt-1 text-xs text-destructive">{errors.subdomain.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("platformSchoolFormDialog.adminUsername")}</Label>
            <Input {...register("adminUsername")} placeholder={t("platformSchoolFormDialog.admin")} />
            {errors.adminUsername && <p className="mt-1 text-xs text-destructive">{errors.adminUsername.message}</p>}
          </div>
          <div>
            <Label>{t("platformSchoolFormDialog.adminPassword")}</Label>
            <Input type="password" {...register("adminPassword")} />
            {errors.adminPassword && <p className="mt-1 text-xs text-destructive">{errors.adminPassword.message}</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("platformSchoolFormDialog.adminNameOptional")}</Label>
            <Input {...register("adminName")} placeholder={t("platformSchoolFormDialog.schoolAdministrator")} />
          </div>
          <div>
            <Label>{t("platformSchoolFormDialog.freeTrialDays")}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              defaultValue={7}
              {...register("trialDays", { valueAsNumber: true })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("platformSchoolFormDialog.theSchoolWorksWithoutAPlan")}
            </p>
            {errors.trialDays && (
              <p className="mt-1 text-xs text-destructive">{errors.trialDays.message}</p>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
