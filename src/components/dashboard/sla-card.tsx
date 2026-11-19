import Link from "next/link";
import { TriangleAlert, ArrowUpRight } from "lucide-react";
import { formatHours } from "@/lib/format";

/** Dark "tracker" card: how fast the department responds and what is overdue. */
export function SlaCard({
  firstResponseHours,
  slaCompliance,
  overdue,
  href,
}: {
  firstResponseHours: number | null;
  slaCompliance: number | null;
  overdue: number;
  href: string;
}) {
  return (
    <section className="relative flex min-h-64 flex-col overflow-hidden rounded-[var(--radius-card)] bg-brand-950 p-6 text-white">
      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 300 260" preserveAspectRatio="none" aria-hidden>
        <path d="M-20 230 C 70 200, 120 120, 320 110" stroke="#2b8b5b" strokeWidth="34" fill="none" opacity="0.35" />
        <path d="M-20 270 C 90 240, 170 170, 320 170" stroke="#48a877" strokeWidth="18" fill="none" opacity="0.25" />
        <path d="M-20 200 C 50 170, 110 90, 320 60" stroke="#195b3b" strokeWidth="50" fill="none" opacity="0.5" />
      </svg>
      <div className="relative flex items-start justify-between">
        <h2 className="text-lg font-semibold">Response tracker</h2>
        <Link href={href} aria-label="Open overdue complaints" className="flex size-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 focus-ring">
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <p className="relative mt-5 text-5xl font-semibold tracking-tight tabular-nums">{formatHours(firstResponseHours)}</p>
      <p className="relative mt-1 text-sm text-brand-100">Average time to first response</p>
      <div className="relative mt-auto flex flex-wrap gap-2 pt-6">
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
          {slaCompliance === null ? "No resolved yet" : `${slaCompliance}% on time`}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${overdue ? "bg-rejected text-white" : "bg-white/15"}`}>
          {overdue ? <TriangleAlert className="size-4" aria-hidden /> : null}
          {overdue} overdue
        </span>
      </div>
    </section>
  );
}
