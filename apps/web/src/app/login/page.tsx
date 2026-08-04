"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useAuth } from "@/lib/auth";
import { portalHomeForRole } from "@/lib/rbac/routes";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useT, type Translate } from "@/lib/i18n/provider";

/**
 * Turn raw API errors into a message the person signing in can act on.
 * "Invalid credentials" is deliberately shown as one combined message —
 * never revealing whether it was the username or the password that was
 * wrong — but phrased so they know to re-check both.
 */
function friendlyLoginError(e: unknown, t: Translate): string {
  if (e instanceof ApiError) {
    const m = e.message.toLowerCase();
    if (m.includes("invalid credentials")) {
      return t("auth.wrongCredentials");
    }
    if (m.includes("no tenant") || m.includes("unknown tenant")) {
      return t("auth.noSchoolLinked");
    }
    // Anything else is the API's own wording and is passed through as-is.
    return e.message;
  }
  return t("auth.loginFailed");
}

export default function LoginPage() {
  const tr = useT();
  const router = useRouter();
  const t = useT();
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
      // Teachers, parents and students each land in their own portal; only
      // staff belong on the admin dashboard.
      router.push(portalHomeForRole(me.role) ?? "/dashboard");
    } catch (e) {
      setError(friendlyLoginError(e, t));
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
      <div className="mb-2 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Card className="w-full border-0 shadow-lg">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-contain" />
            ) : null}
            <h1 className="text-2xl font-bold text-primary">{branding.loginTitle}</h1>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{branding.tagline}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("auth.signInToContinue")}
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("auth.idOrUsername")}
              </label>
              <Input
                {...register("identifier")}
                placeholder={tr("login.admin")}
                autoComplete="username"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("auth.password")}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                  title={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
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
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">{branding.footerText}</p>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
