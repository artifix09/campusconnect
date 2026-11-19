export type DepartmentDatum = {
  name: string;
  short: string;
  resolved: number;
  inProgress: number;
  pending: number;
  rejected: number;
  total: number;
};

const SEGMENTS = [
  { key: "resolved", label: "Resolved", className: "bg-brand-600" },
  { key: "inProgress", label: "In progress", className: "bg-brand-900" },
  { key: "pending", label: "Pending", className: "bg-hatch" },
  { key: "rejected", label: "Rejected", className: "bg-rejected/80" },
] as const;

/**
 * The brief's bar chart: complaints received per department, each bar split
 * by status. Bars share one scale so heights compare honestly.
 */
export function DepartmentBars({ data }: { data: DepartmentDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const caption = "Complaints received by department, split by status";

  return (
    <figure>
      <div className="flex h-56 items-end gap-3 sm:gap-6" aria-hidden>
        {data.map((d) => (
          <div key={d.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-semibold tabular-nums text-ink">{d.total}</span>
            <div
              className="flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-full border border-brand-800/10 bg-shell"
              style={{ height: `${Math.max(6, (d.total / max) * 100)}%` }}
              title={`${d.name}: ${d.total}`}
            >
              {d.total > 0
                ? SEGMENTS.map((s) =>
                    d[s.key] > 0 ? (
                      <div key={s.key} className={s.className} style={{ height: `${(d[s.key] / d.total) * 100}%` }} />
                    ) : null,
                  )
                : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-3 sm:gap-6" aria-hidden>
        {data.map((d) => (
          <span key={d.name} className="min-w-0 flex-1 truncate text-center text-xs font-medium text-muted" title={d.name}>
            {d.short}
          </span>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`size-3 rounded-full border border-brand-800/20 ${s.className}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">Total</th>
            {SEGMENTS.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <th scope="row">{d.name}</th>
              <td>{d.total}</td>
              {SEGMENTS.map((s) => (
                <td key={s.key}>{d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
