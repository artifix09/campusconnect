import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">You will be signed out on all other devices.</p>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
