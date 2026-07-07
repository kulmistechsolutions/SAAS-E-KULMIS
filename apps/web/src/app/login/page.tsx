"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const branding = useSchoolBranding();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      await login(values.identifier, values.password);
      router.push("/dashboard");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Login failed. Please try again.",
      );
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: branding.loginBackgroundUrl
          ? `url(${branding.loginBackgroundUrl}) center/cover`
          : undefined,
      }}
    >
      <div className={branding.loginBackgroundUrl ? "w-full max-w-sm rounded-2xl bg-background/95 p-1 shadow-xl backdrop-blur" : "w-full max-w-sm"}>
      <Card className="w-full border-0 shadow-lg">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
            ) : null}
            <h1 className="text-2xl font-bold text-primary">{branding.loginTitle}</h1>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{branding.tagline}</p>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                ID / Username
              </label>
              <Input
                {...register("identifier")}
                placeholder="admin"
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">{branding.footerText}</p>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
