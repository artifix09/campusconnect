import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** KPI tile. The `featured` tile uses the brand gradient, like the first card of the dashboard. */
export function StatCard({
  label,
  value,
  note,
  href,
  featured = false,
  icon,
}: {
  label: string;
  value: number | string;
  note?: ReactNode;
  href?: string;
  featured?: boolean;
  icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[0.9375rem] font-semibold sm:text-base", featured ? "text-white" : "text-ink")}>{label}</p>
        {href || icon ? (
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 group-hover:rotate-45",
              featured ? "border-white/60 bg-white text-brand-900" : "border-line-strong text-ink",
            )}
          >
            {icon ?? <ArrowUpRight className="size-4" />}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-4 text-[2rem] font-semibold leading-none tracking-tight tabular-nums [overflow-wrap:normal] sm:text-5xl",
          featured ? "text-white" : "text-ink",
        )}
      >
        {value}
      </p>
      {note ? (
        <p className={cn("mt-4 flex items-center gap-1.5 text-xs font-medium", featured ? "text-brand-100" : "text-muted")}>
          {note}
        </p>
      ) : null}
    </>
  );

  const shell = cn(
    "group block rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 sm:p-6",
    featured ? "bg-brand-gradient" : "bg-surface",
    href && "hover:shadow-[var(--shadow-pop)] focus-ring",
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** Small boxed counter used inside StatCard notes, like "5 up". */
export function NoteChip({ children, featured = false }: { children: ReactNode; featured?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-px text-[0.6875rem] font-semibold",
        featured ? "border-brand-200/70 text-brand-100" : "border-line-strong text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}
