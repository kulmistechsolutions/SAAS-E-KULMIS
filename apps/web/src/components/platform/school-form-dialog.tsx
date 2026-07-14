"use client";

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
      title="Provision New School"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="platform-school-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create School"}
          </Button>
        </>
      }
    >
      <form id="platform-school-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <div>
          <Label>School Name</Label>
          <Input {...register("name")} placeholder="Al-Noor International School" />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <Label>Subdomain</Label>
          <Input {...register("subdomain")} placeholder="alnoor" />
          <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, hyphens only</p>
          {errors.subdomain && <p className="mt-1 text-xs text-destructive">{errors.subdomain.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Admin Username</Label>
            <Input {...register("adminUsername")} placeholder="admin" />
            {errors.adminUsername && <p className="mt-1 text-xs text-destructive">{errors.adminUsername.message}</p>}
          </div>
          <div>
            <Label>Admin Password</Label>
            <Input type="password" {...register("adminPassword")} />
            {errors.adminPassword && <p className="mt-1 text-xs text-destructive">{errors.adminPassword.message}</p>}
          </div>
        </div>
        <div>
          <Label>Admin Name (optional)</Label>
          <Input {...register("adminName")} placeholder="School Administrator" />
        </div>
      </form>
    </Dialog>
  );
}
