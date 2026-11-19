"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";

type Errors = Partial<Record<"name" | "email" | "registrationNo" | "password" | "confirm", string>>;

export function RegisterForm() {
  const [form, setForm] = useState({ name: "", email: "", registrationNo: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate(): Errors {
    const next: Errors = {};
    if (form.name.trim().length < 3) next.name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.registrationNo.trim().length < 4) next.registrationNo = "Enter your registration number.";
    if (form.password.length < 10) next.password = "Use at least 10 characters.";
    if (form.confirm !== form.password) next.confirm = "The passwords do not match.";
    return next;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      registrationNo: form.registrationNo.trim().toUpperCase(),
      callbackURL: "/student",
    });
    setLoading(false);
    if (error) {
      setServerError(error.status === 429 ? "Too many attempts. Please try again later." : (error.message ?? "Registration failed."));
      return;
    }
    setSentTo(form.email.trim().toLowerCase());
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
          <MailCheck className="size-8" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Check your inbox</h1>
        <p className="mt-3 text-[0.9375rem] text-muted">
          We sent a confirmation link to <span className="font-semibold text-ink">{sentTo}</span>. Open it to activate
          your account. The link expires in 24 hours.
        </p>
        <ButtonLink href="/login" variant="outline" className="mt-8">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Create your account</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">For enrolled students. Use your university email.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        {serverError ? <FormMessage>{serverError}</FormMessage> : null}

        <Field label="Full name" error={errors.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={set("name")} />}
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="University email" error={errors.email}>
            {(p) => (
              <Input {...p} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} />
            )}
          </Field>
          <Field label="Registration no." error={errors.registrationNo} hint="e.g. 2023-ARID-4101">
            {(p) => (
              <Input {...p} autoCapitalize="characters" value={form.registrationNo} onChange={set("registrationNo")} />
            )}
          </Field>
        </div>

        <Field label="Password" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.password} onChange={set("password")} />}
        </Field>
        <PasswordStrength value={form.password} />

        <Field label="Confirm password" error={errors.confirm}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />}
        </Field>

        <Button type="submit" size="lg" loading={loading} icon={<UserPlus className="size-5" aria-hidden />} className="mt-1 w-full">
          Create account
        </Button>

        <p className="text-center text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
