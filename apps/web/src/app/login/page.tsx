"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useAuth } from "@/lib/auth";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Turn raw API errors into a message the person signing in can act on.
 * "Invalid credentials" is deliberately shown as one combined message —
 * never revealing whether it was the username or the password that was
 * wrong — but phrased so they know to re-check both.
 */
function friendlyLoginError(e: unknown): string {
  if (e instanceof ApiError) {
    const m = e.message.toLowerCase();
    if (m.includes("invalid credentials")) {
      return "Wrong username or password. Please check both and try again.";
    }
    if (m.includes("no tenant") || m.includes("unknown tenant")) {
      return "This sign-in page isn't linked to a school. Open your school's own address (e.g. yourschool.ekulmis.com) and sign in there.";
    }
    return e.message;
  }
  return "Login failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const branding = useSchoolBranding();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      const me = await login(values.identifier, values.password);
      router.push(me.role === "TEACHER" ? "/teacher-portal" : "/dashboard");
    } catch (e) {
      setError(friendlyLoginError(e));
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
              <img src={branding.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-contain" />
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
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
              >
                {error}
              </div>
            )}
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
