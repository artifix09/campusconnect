"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    // Same message whether or not the account exists, so emails cannot be probed.
    if (error?.status === 429) setError("Too many requests. Please try again in an hour.");
    else setSent(true);
  }

  return (
    <>
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">Enter your email and we will send you a reset link.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        {error ? <FormMessage>{error}</FormMessage> : null}
        {sent ? (
          <FormMessage tone="success">
            If an account exists for {email}, a reset link is on its way. It expires in 30 minutes.
          </FormMessage>
        ) : null}
        <Field label="University email">
          {(p) => (
            <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" loading={loading} icon={<Send className="size-5" aria-hidden />} className="w-full">
          Send reset link
        </Button>
      </form>
    </>
  );
}
