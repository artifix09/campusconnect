import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">Sign in to report an issue or check on one you filed.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
