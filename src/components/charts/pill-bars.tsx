import { cn } from "@/lib/cn";

export type PillDatum = {
  label: string;
  fullLabel: string;
  value: number;
  upcoming?: boolean;
  current?: boolean;
};

/**
 * Week view of complaints received per day, drawn as rounded pills.
 * Days that have not happened yet are hatched; today is highlighted with its count.
 */
export function PillBars({ data, caption }: { data: PillDatum[]; caption: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d) => (!d.upcoming && d.value > best ? d.value : best), 0);

  return (
    <figure className="w-full">
      <div className="flex h-48 items-end justify-between gap-2 sm:gap-3" aria-hidden>
        {data.map((d) => {
          const height = d.upcoming ? 62 : Math.max(14, Math.round((d.value / max) * 100));
          const tone = d.upcoming
            ? "bg-hatch border border-brand-800/20"
            : d.current
              ? "bg-brand-300"
              : d.value === peak && peak > 0
                ? "bg-brand-800"
                : "bg-brand-600";
          return (
            <div key={d.fullLabel} className="relative flex h-full flex-1 flex-col items-center justify-end">
              {d.current ? (
                <span className="absolute -top-1 z-10 rounded-md border border-brand-200 bg-surface px-1.5 py-0.5 text-[0.6875rem] font-semibold text-brand-800 shadow-[var(--shadow-card)]">
                  {d.value}
                </span>
              ) : null}
              <div
                className={cn("w-full max-w-14 rounded-full transition-[height] duration-500 ease-out", tone)}
                style={{ height: `${height}%` }}
                title={d.upcoming ? `${d.fullLabel}: upcoming` : `${d.fullLabel}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between gap-2 sm:gap-3" aria-hidden>
        {data.map((d) => (
          <span
            key={d.fullLabel}
            className={cn(
              "flex-1 text-center text-sm",
              d.current ? "font-semibold text-brand-800" : "text-muted",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      {/* Tables ignore width:1px, so the hidden wrapper is a div. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Complaints</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.fullLabel}>
                <th scope="row">{d.fullLabel}</th>
                <td>{d.upcoming ? "Upcoming" : d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
