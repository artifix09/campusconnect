import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSessionState } from "@/lib/session";
import { SetupTwoFactorClient } from "./setup-client";

export const metadata = { title: "Set up two-step verification" };

export default async function SetupTwoFactorPage() {
  const state = await getSessionState(await headers());
  if (!state) redirect("/login");
  if (state.mustChangePassword) redirect("/setup/password");
  if (state.twoFactorEnabled || state.actor.role === "STUDENT") redirect("/");

  return (
    <>
      <span className="mb-6 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
        <ShieldCheck className="size-7" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Protect your staff account</h1>
      <p className="mb-8 mt-2 text-[0.9375rem] text-muted">
        Staff accounts can read students&apos; complaints, so they need a second step at sign-in.
      </p>
      <SetupTwoFactorClient />
    </>
  );
}
