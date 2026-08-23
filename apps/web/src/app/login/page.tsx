"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { apiGetBranding } from "@/lib/settings/api";
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

/**
 * Staff login is the address everyone knows, so it is where parents and
 * students end up too — the audit trail shows them failing over and over on
 * a student code, a parent code, even the results page URL pasted into the
 * username box. Recognise the shape of what was typed and send them to the
 * door that will actually open.
 *
 * Shape only — nothing is looked up — so this can neither confirm nor deny
 * that any particular account exists.
 */
function misdirected(identifier: string):
  | { kind: "results" | "portal"; hint: string }
  | null {
  const v = identifier.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.includes("/")) {
    return {
      kind: v.toLowerCase().includes("result") ? "results" : "portal",
      hint: "That looks like a web address, not a username. Try one of the links below.",
    };
  }
  // Student and parent codes are letters then digits (STD0001, NPAR0136,
  // HA00047) — never how a staff username is issued.
  if (/^[A-Za-z]{2,6}\d{3,6}$/.test(v)) {
    return {
      kind: "portal",
      hint: "That looks like a student or parent ID. Those sign in on their own portal, not here.",
    };
  }
  return null;
}

export default function LoginPage() {
  const tr = useT();
  const router = useRouter();
  const t = useT();
  const { login } = useAuth();
  const branding = useSchoolBranding();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Only offer the doors this school actually opened. Undefined until it
  // loads; the parent and teacher portals always exist.
  const [portals, setPortals] = useState<{
    student: boolean;
    publicResults: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGetBranding()
      .then((b) => alive && b.portals && setPortals(b.portals))
      .catch(() => {
        /* the links just stay at their safe defaults */
      });
    return () => {
      alive = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    setHint(null);
    try {
      const me = await login(values.identifier, values.password);
      // Teachers, parents and students each land in their own portal; only
      // staff belong on the admin dashboard.
      router.push(portalHomeForRole(me.role) ?? "/dashboard");
    } catch (e) {
      setError(friendlyLoginError(e, t));
      setHint(misdirected(values.identifier)?.hint ?? null);
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
            {hint && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                {hint}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          {/* Every other way in, named plainly. This page is the address
              people are given, so it has to be able to redirect them. */}
          <div className="mt-6 border-t pt-4">
            <p className="text-center text-xs font-medium text-muted-foreground">
              {t("auth.notStaffQuestion")}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
              <Link href="/parent-portal/login" className="font-medium text-primary hover:underline">
                {t("auth.parentPortalLink")}
              </Link>
              {portals?.student !== false && (
                <Link href="/student-portal/login" className="font-medium text-primary hover:underline">
                  {t("auth.studentPortalLink")}
                </Link>
              )}
              <Link href="/teacher-portal/login" className="font-medium text-primary hover:underline">
                {t("auth.teacherPortalLink")}
              </Link>
              {portals?.publicResults !== false && (
                <Link href="/results" className="font-medium text-primary hover:underline">
                  {t("auth.checkResultsLink")}
                </Link>
              )}
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">{branding.footerText}</p>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
