import { SearchX } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <span className="flex size-16 items-center justify-center rounded-full bg-surface text-brand-700" aria-hidden>
        <SearchX className="size-8" />
      </span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">We could not find that page</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-muted">
          The link may be wrong, or the complaint may have been removed.
        </p>
      </div>
      <ButtonLink href="/">Go home</ButtonLink>
    </main>
  );
}
