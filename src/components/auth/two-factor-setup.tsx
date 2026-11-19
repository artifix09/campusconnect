"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { CodeInput } from "./code-input";
import { PasswordInput } from "./password-input";
import { QrCode } from "./qr-code";

type Step = "password" | "scan" | "codes";

/** Three steps: confirm password, scan and verify, save backup codes. */
export function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const secret = uri ? (new URL(uri).searchParams.get("secret") ?? "") : "";

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setLoading(false);
    if (error || !data) return setError(error?.message ?? "Your password is not correct.");
    if (!("totpURI" in data)) return setError("Authenticator apps are not enabled on this server.");
    setUri(data.totpURI);
    setBackupCodes(data.backupCodes);
    setStep("scan");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (error) return setError("That code did not match. Check the time on your phone and try again.");
    setStep("codes");
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (step === "password") {
    return (
      <form onSubmit={start} className="flex flex-col gap-5">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field label="Confirm your password">
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Continue
        </Button>
      </form>
    );
  }

  if (step === "scan") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-5">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <ol className="flex flex-col gap-2 text-sm text-ink-soft">
          <li>1. Open Google Authenticator, Microsoft Authenticator or a similar app.</li>
          <li>2. Scan this code, or type the key below.</li>
          <li>3. Enter the 6-digit code the app shows.</li>
        </ol>
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-shell p-5">
          <QrCode value={uri} label="QR code for your authenticator app" />
          <code className="break-all rounded-xl bg-surface px-3 py-2 text-center text-sm font-semibold tracking-wider text-ink">
            {secret}
          </code>
        </div>
        <Field label="Code from the app">
          {(p) => <CodeInput {...p} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Turn on two-step verification
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <FormMessage tone="success">Two-step verification is on.</FormMessage>
      <p className="text-sm text-ink-soft">
        Save these backup codes somewhere safe. Each one works once if you lose your phone.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] bg-shell p-4 font-mono text-sm font-semibold text-ink">
        {backupCodes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Button
        variant="outline"
        onClick={copyCodes}
        icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      >
        {copied ? "Copied" : "Copy codes"}
      </Button>
      <Button size="lg" onClick={onDone} className="w-full">
        I have saved my codes
      </Button>
    </div>
  );
}
