"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-rejected-soft text-rejected" aria-hidden>
        <TriangleAlert className="size-8" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-muted">
          Please try again. If it keeps happening, share this code with the IT office:{" "}
          <span className="font-mono font-semibold text-ink">{error.digest ?? "unknown"}</span>
        </p>
      </div>
      <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>
        Try again
      </Button>
    </main>
  );
}
