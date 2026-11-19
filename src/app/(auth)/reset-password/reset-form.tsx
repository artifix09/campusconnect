"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";

export function ResetForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <FormMessage>This reset link is invalid or has expired. Request a new one.</FormMessage>
        <ButtonLink href="/forgot-password" variant="outline">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The passwords do not match.");
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setLoading(false);
    if (error) setError(error.message ?? "This reset link is invalid or has expired.");
    else setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <FormMessage tone="success">Your password has been changed. Sign in with your new password.</FormMessage>
        <ButtonLink href="/login">Go to sign in</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Field label="New password">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <PasswordStrength value={password} />
      <Field label="Confirm new password">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={loading} icon={<KeyRound className="size-5" aria-hidden />} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
