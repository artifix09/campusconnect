"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { CodeInput } from "@/components/auth/code-input";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setLoading(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Wait a few minutes." : "That code is not valid. Try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <span className="mb-6 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
        <ShieldCheck className="size-7" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Two-step verification</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">
        {useBackup ? "Enter one of your saved backup codes." : "Enter the 6-digit code from your authenticator app."}
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field label={useBackup ? "Backup code" : "Verification code"}>
          {(p) =>
            useBackup ? (
              <Input {...p} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <CodeInput {...p} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            )
          }
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Verify and continue
        </Button>
        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v);
            setCode("");
          }}
          className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline"
        >
          {useBackup ? "Use authenticator code instead" : "Lost your phone? Use a backup code"}
        </button>
      </form>
    </>
  );
}
