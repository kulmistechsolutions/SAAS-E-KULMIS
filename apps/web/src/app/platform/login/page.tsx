"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { Shield } from "lucide-react";
import { usePlatformAuth } from "@/lib/platform/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "@/lib/toast";

export default function PlatformLoginPage() {
  const router = useRouter();
  const { admin, login, isPreview } = usePlatformAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (admin) router.replace("/platform");
  }, [admin, router]);

  async function onSubmit(values: LoginInput) {
    try {
      await login(values.identifier, values.password);
      toast("Welcome, Super Admin", "success");
      router.push("/platform");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Login failed", "error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1120] p-4">
      <Card className="w-full max-w-md border-white/10 bg-[#0f172a] text-slate-200 shadow-2xl">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-white">Platform Super Admin</h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage all schools and tenants across eKulmis
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Username</label>
              <Input
                {...register("identifier")}
                placeholder="superadmin"
                autoComplete="username"
                className="border-white/10 bg-white/5 text-white"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-rose-400">{errors.identifier.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <Input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                autoComplete="current-password"
                className="border-white/10 bg-white/5 text-white"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in to Platform"}
            </Button>
          </form>

          {isPreview && (
            <p className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-center text-xs text-violet-200">
              Preview: <span className="font-mono">superadmin</span> / <span className="font-mono">super123</span>
            </p>
          )}
          {!isPreview && (
            <p className="mt-4 text-center text-xs text-slate-500">
              API login · seed with <span className="font-mono">node apps/api/seed-superadmin.cjs</span>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="text-violet-400 hover:underline">
              ← School ERP login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
