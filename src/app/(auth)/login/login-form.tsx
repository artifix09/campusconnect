"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setUnverified(false);
    setLoading(true);
    const { data, error } = await authClient.signIn.email({ email, password, rememberMe: !shared });
    setLoading(false);

    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
        setError("Please confirm your email first. We sent you a link when you registered.");
      } else if (error.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(error.message ?? "Invalid email or password.");
      }
      return;
    }
    // Staff with 2FA are redirected to /two-factor by the auth client plugin.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    const next = params.get("next");
    router.replace(next?.startsWith("/") ? next : "/");
    router.refresh();
  }

  async function resendVerification() {
    await authClient.sendVerificationEmail({ email, callbackURL: "/student" });
    setNotice("A new confirmation link is on its way. Check your inbox and spam folder.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
      {error ? (
        <FormMessage>
          {error}
          {unverified ? (
            <button type="button" onClick={resendVerification} className="ml-1 cursor-pointer font-semibold underline">
              Resend link
            </button>
          ) : null}
        </FormMessage>
      ) : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}

      <Field label="University email">
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@biit.edu.pk"
          />
        )}
      </Field>

      <Field label="Password">
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2.5 text-ink-soft">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="size-5 cursor-pointer rounded-md accent-brand-700"
          />
          This is a shared computer
        </label>
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={loading} icon={<LogIn className="size-5" aria-hidden />} className="mt-1 w-full">
        Sign in
      </Button>

      <p className="text-center text-sm text-muted">
        New to CampusConnect?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create a student account
        </Link>
      </p>
    </form>
  );
}
