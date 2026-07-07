"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loginParent, usePortalState } from "@/lib/parent-portal/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { toast } from "@/lib/toast";

const schema = z.object({
  identifier: z.string().min(1, "Parent ID is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function ParentPortalLoginPage() {
  const router = useRouter();
  const portal = usePortalState();
  const branding = useSchoolBranding();
  const [mounted, setMounted] = useState(false);
  const [demo, setDemo] = useState<{ code: string; password: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (portal.session) router.replace("/parent-portal");
  }, [portal.session, router]);

  useEffect(() => {
    if (!mounted) return;
    const st = getStudentsState();
    const parent = st.parents.find(
      (p) => p.status === "ACTIVE" && st.students.some((s) => s.parentId === p.id),
    );
    if (parent) setDemo({ code: parent.code, password: parent.password });
  }, [mounted]);

  async function onSubmit(values: FormValues) {
    const result = loginParent(values.identifier, values.password);
    if (!result.ok) {
      toast(result.error ?? "Login failed", "error");
      return;
    }
    toast(`Welcome, ${result.parent?.name}`, "success");
    router.push("/parent-portal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
                {branding.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl font-bold text-primary">{branding.name}</h1>
            <p className="text-sm font-medium text-muted-foreground">Parent Portal</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your Parent ID and password
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Parent ID</label>
              <Input
                {...register("identifier")}
                placeholder="PSHMM000025"
                autoComplete="username"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-destructive">{errors.identifier.message}</p>
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
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in to Parent Portal"}
            </Button>
          </form>

          {demo && (
            <p className="mt-4 rounded-lg border bg-secondary/50 p-3 text-center text-xs text-muted-foreground">
              Demo: <span className="font-mono font-medium text-foreground">{demo.code}</span>
              {" · "}
              Password shown in admin Parents profile
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
