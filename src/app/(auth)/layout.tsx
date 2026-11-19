import type { ReactNode } from "react";
import { CircleCheck, ShieldCheck, TimerReset } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const POINTS = [
  { icon: CircleCheck, text: "Goes straight to the right office: Cafeteria, Library, Labs or Academics." },
  { icon: TimerReset, text: "Track every step, with a reply from the department you can read." },
  { icon: ShieldCheck, text: "Report teaching issues anonymously. Departments never see your name." },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh p-3 sm:p-4">
      <div className="mx-auto grid w-full max-w-[90rem] overflow-hidden rounded-[var(--radius-panel)] bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <main id="main" className="flex flex-col px-5 py-8 sm:px-12 sm:py-10">
          <Logo />
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[26rem] animate-fade-up">{children}</div>
          </div>
          <p className="text-xs text-muted">
            BIIT CampusConnect. For help, contact the IT office.
          </p>
        </main>

        <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col" aria-hidden>
          <svg className="pointer-events-none absolute inset-0 size-full opacity-50" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
            <path d="M-80 640 C 120 560, 260 380, 680 300" stroke="#48a877" strokeWidth="70" fill="none" opacity="0.18" />
            <path d="M-80 760 C 160 680, 340 520, 680 470" stroke="#76c39b" strokeWidth="40" fill="none" opacity="0.15" />
          </svg>

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-200">Smart campus feedback</p>
            <h2 className="mt-4 max-w-md text-[2.6rem] font-semibold leading-[1.1] tracking-tight">
              Every campus issue, heard and handled.
            </h2>
            <ul className="mt-8 flex max-w-md flex-col gap-4">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-[0.9375rem] text-brand-50">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand-200" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* A glimpse of the product: a complaint card and a week chart */}
          <div className="relative mt-auto grid grid-cols-[1.15fr_1fr] gap-4">
            <div className="rounded-[var(--radius-card)] bg-white p-5 text-ink shadow-[var(--shadow-pop)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">CC-2026-000123</span>
                <span className="rounded-full border border-resolved/25 bg-resolved-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-resolved">
                  Resolved
                </span>
              </div>
              <p className="mt-3 font-semibold">Internet down in Lab 3</p>
              <p className="mt-1 text-xs text-muted">Laboratory / IT Administration</p>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-shell p-3 text-xs text-ink-soft">
                <span className="size-2 rounded-full bg-brand-500" />
                Switch replaced. All 40 PCs tested online.
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-[var(--radius-card)] bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-semibold">This week</p>
              <div className="mt-4 flex h-28 items-end gap-2">
                {[55, 80, 45, 100, 62, 62, 62].map((h, i) => (
                  <div
                    key={i}
                    className={i > 3 ? "flex-1 rounded-full bg-hatch-soft border border-white/30" : i === 3 ? "flex-1 rounded-full bg-white" : "flex-1 rounded-full bg-brand-300"}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
