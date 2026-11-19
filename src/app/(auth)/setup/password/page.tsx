import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Choose your password" };

export default async function SetupPasswordPage() {
  const state = await getSessionState(await headers());
  if (!state) redirect("/login");
  if (!state.mustChangePassword) redirect("/");

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Choose your own password</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">
        Welcome, {state.actor.name}. Replace the one-time password from your email before you continue.
      </p>
      <ChangePasswordForm />
    </>
  );
}
