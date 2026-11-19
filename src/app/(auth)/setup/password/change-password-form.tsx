"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";

export function ChangePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 10) return setError("Use at least 10 characters.");
    if (next !== confirm) return setError("The new passwords do not match.");
    if (next === current) return setError("Choose a password different from the one-time password.");
    setLoading(true);
    setError(null);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setLoading(false);
    if (error) return setError(error.message ?? "Your current password is not correct.");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Field label="One-time password">
        {(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field label="New password">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <PasswordStrength value={next} />
      <Field label="Confirm new password">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Save and continue
      </Button>
    </form>
  );
}
