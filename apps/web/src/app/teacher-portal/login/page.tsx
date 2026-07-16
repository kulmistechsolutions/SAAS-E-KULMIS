"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen } from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loginTeacher, useTeacherPortalState } from "@/lib/teacher-portal/store";
import { toast } from "@/lib/toast";

const schema = z.object({
  identifier: z.string().min(1, "Teacher ID is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function TeacherPortalLoginPage() {
  const router = useRouter();
  const portal = useTeacherPortalState();
  const branding = useSchoolBranding();
  const [mounted, setMounted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (portal.session) router.replace("/teacher-portal");
  }, [portal.session, router]);

  async function onSubmit(values: FormValues) {
    const result = await loginTeacher(values.identifier, values.password);
    if (!result.ok) {
      toast(result.error ?? "Login failed", "error");
      return;
    }
    toast(`Welcome, ${result.teacher?.fullName ?? "Teacher"}`, "success");
    // Hard navigation (not router.push): a client-side transition here races
    // with the global AuthProvider re-reading /auth/me and can bounce a
    // just-authenticated teacher to the staff /login. A full load lands cleanly.
    window.location.assign("/teacher-portal");
  }

  if (!mounted) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt=""
                className="mx-auto mb-3 h-14 w-14 rounded-full object-contain"
              />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <BookOpen className="h-7 w-7" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-primary">{branding.name}</h1>
            <p className="text-sm font-medium text-muted-foreground">Teacher Portal</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your Teacher ID and password
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Teacher ID</label>
              <Input
                {...register("identifier")}
                placeholder="TCH0001"
                autoComplete="username"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <Input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in to Teacher Portal"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Staff admin login is at{" "}
            <a href="/login" className="text-primary hover:underline">
              school sign-in
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
