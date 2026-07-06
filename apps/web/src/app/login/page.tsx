"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@ekulmis/shared";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
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
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-primary">eKulmis</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
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
        </CardContent>
      </Card>
    </main>
  );
}
