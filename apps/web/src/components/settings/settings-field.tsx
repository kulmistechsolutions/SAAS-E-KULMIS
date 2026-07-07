"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

export function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function SettingsInput({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <SettingsField label={label}>
      <Input {...props} />
    </SettingsField>
  );
}

export function SettingsTextarea({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Textarea>) {
  return (
    <SettingsField label={label}>
      <Textarea {...props} />
    </SettingsField>
  );
}

export function SettingsSelect({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<typeof Select>) {
  return (
    <SettingsField label={label}>
      <Select {...props}>{children}</Select>
    </SettingsField>
  );
}
