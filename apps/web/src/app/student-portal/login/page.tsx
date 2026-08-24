"use client";

import { useState } from "react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { apiStudentPortalLogin } from "@/lib/student-portal/api";
import { ApiError } from "@/lib/api";

export default function StudentPortalLoginPage() {
  const router = useRouter();
  const branding = useSchoolBranding();
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiStudentPortalLogin(studentCode.trim(), password);
      router.push("/student-portal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm space-y-6">
        {/* A student who cannot read English has to be able to switch
            before signing in, not only after. */}
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt=""
              className="h-16 w-16 rounded-xl object-contain ring-1 ring-black/5"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-8 w-8" />
            </div>
          )}
          <h1 className="text-lg font-semibold">{branding.name}</h1>
          <p className="text-sm text-muted-foreground">Student Portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
        >
          <div>
            <h2 className="text-xl font-bold">Student Sign In</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your Student ID and portal password.
            </p>
          </div>
          <div>
            <Label htmlFor="studentCode">Student ID</Label>
            <Input
              id="studentCode"
              className="mt-1.5"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="e.g. STU-000001"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your default password is your Student ID unless the school gave you a
              different one.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
