"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { authClient, signOutEverywhere } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage } from "@/components/ui/field";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";

export function SecuritySettings({ staff, twoFactorEnabled }: { staff: boolean; twoFactorEnabled: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "password" | "2fa">(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 10) return setMessage({ tone: "error", text: "Use at least 10 characters." });
    setBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (error) return setMessage({ tone: "error", text: error.message ?? "Your current password is not correct." });
    setDialog(null);
    setCurrent("");
    setNext("");
    setMessage({ tone: "success", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <div className="flex flex-col gap-4">
      {message && dialog === null ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <div className="flex items-center gap-3 rounded-[1.25rem] bg-shell p-4">
        <ShieldCheck className={twoFactorEnabled ? "size-6 text-brand-700" : "size-6 text-muted"} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Two-step verification</p>
          <p className="text-sm text-muted">{twoFactorEnabled ? "On. A code is needed at sign-in." : staff ? "Required for staff accounts." : "Optional extra protection."}</p>
        </div>
        {!twoFactorEnabled ? (
          <Button size="sm" variant="soft" onClick={() => setDialog("2fa")}>
            Set up
          </Button>
        ) : null}
      </div>

      <Button variant="outline" onClick={() => { setMessage(null); setDialog("password"); }} icon={<KeyRound className="size-4" aria-hidden />}>
        Change password
      </Button>
      <Button variant="ghost" onClick={() => void signOutEverywhere()} icon={<LogOut className="size-4" aria-hidden />} className="text-rejected hover:bg-rejected-soft hover:text-rejected">
        Sign out of this device
      </Button>

      <Dialog open={dialog === "password"} onClose={() => setDialog(null)} title="Change password" description="You will stay signed in here. Other devices are signed out.">
        <form onSubmit={changePassword} className="flex flex-col gap-4">
          {message?.tone === "error" ? <FormMessage>{message.text}</FormMessage> : null}
          <Field label="Current password">
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label="New password">
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <PasswordStrength value={next} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save password</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === "2fa"} onClose={() => setDialog(null)} title="Set up two-step verification">
        <TwoFactorSetup
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      </Dialog>
    </div>
  );
}
