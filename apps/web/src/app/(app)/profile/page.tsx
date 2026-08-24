"use client";


import { useT } from "@/lib/i18n/provider";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiChangePassword,
  apiUpdateTeacherMe,
  type TeacherMe,
} from "@/lib/teachers/api";
import { loadTeacherMe } from "@/lib/teachers/session";
import { shiftsLabel } from "@/lib/teachers/format";
import { useShifts } from "@/lib/teachers/shifts";
import { toast } from "@/lib/toast";

export default function TeacherProfilePage() {
  const tr = useT();
  useShifts();
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    void loadTeacherMe(true)
      .then((t) => {
        setMe(t);
        setPhone(t.phone ?? "");
        setEmail(t.email ?? "");
        setAddress(t.address ?? "");
      })
      .catch(() => toast("Could not load profile", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await apiUpdateTeacherMe({
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
      setMe(updated);
      toast("Profile updated", "success");
    } catch {
      toast("Could not update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }
    setChangingPw(true);
    try {
      await apiChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed", "success");
    } catch {
      toast("Could not change password — check current password", "error");
    } finally {
      setChangingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!me) {
    return (
      <p className="text-center text-muted-foreground">
        {tr("profile.teacherProfileNotFoundForThis")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{tr("profile.myProfile")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("profile.viewYourAccountDetailsAndUpdate")}
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("profile.account")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("profile.teacherId")} value={me.code} />
          <Field label={tr("profile.fullName")} value={me.fullName} />
          <Field label={tr("profile.gender")} value={me.gender} />
          <Field label={tr("profile.shift")} value={shiftsLabel(me.shifts)} />
          <Field label={tr("profile.status")} value={me.status} />
          <Field label={tr("profile.qualification")} value={me.qualification ?? "—"} />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("profile.contactEditable")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">{tr("profile.phone")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">{tr("profile.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">{tr("profile.address")}</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <Button onClick={() => void saveProfile()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("profile.changePassword")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="currentPw">{tr("profile.currentPassword")}</Label>
            <Input
              id="currentPw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="newPw">{tr("profile.newPassword")}</Label>
            <Input
              id="newPw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="confirmPw">{tr("profile.confirmPassword")}</Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void changePassword()}
          disabled={changingPw}
        >
          {changingPw ? "Updating…" : "Update password"}
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("profile.teachingAssignments")}
        </h2>
        {me.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr("profile.noSubjectsAssignedYetContactYour")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="pb-2 pe-3 font-medium">{tr("profile.year")}</th>
                  <th className="pb-2 pe-3 font-medium">{tr("profile.class")}</th>
                  <th className="pb-2 pe-3 font-medium">{tr("profile.section")}</th>
                  <th className="pb-2 font-medium">{tr("profile.subject")}</th>
                </tr>
              </thead>
              <tbody>
                {me.assignments.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pe-3">{a.academicYear.name}</td>
                    <td className="py-2 pe-3">{a.class.name}</td>
                    <td className="py-2 pe-3">{a.section?.name ?? "All"}</td>
                    <td className="py-2">{a.subject.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Anyone who closed the install banner can still get the app here. */}
      <InstallAppCard />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
