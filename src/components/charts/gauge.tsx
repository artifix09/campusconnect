/**
 * Half-circle progress gauge: resolved (green), in progress (dark green)
 * and still pending (hatched). The headline is the resolved share.
 */
export function Gauge({
  resolved,
  inProgress,
  pending,
  label = "Resolved",
}: {
  resolved: number;
  inProgress: number;
  pending: number;
  label?: string;
}) {
  const total = resolved + inProgress + pending;
  const share = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const percent = Math.round(share(resolved));
  const gap = total > 0 ? 1.5 : 0;

  const segments = [
    { key: "resolved", value: share(resolved), stroke: "#1f7148" },
    { key: "progress", value: share(inProgress), stroke: "#0f3624" },
    { key: "pending", value: share(pending), stroke: "url(#gauge-hatch)" },
  ].filter((s) => s.value > 0);

  let offset = 0;
  const arc = "M 24 120 A 96 96 0 0 1 216 120";

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 240 132" className="w-full max-w-[18rem]" role="img" aria-label={`${percent}% ${label.toLowerCase()}`}>
        <defs>
          <pattern id="gauge-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#ffffff" />
            <rect width="2.2" height="7" fill="#195b3b" opacity="0.55" />
          </pattern>
        </defs>
        <path d={arc} fill="none" stroke="#eef1ef" strokeWidth="34" strokeLinecap="round" pathLength={100} />
        {segments.map((s) => {
          const length = Math.max(0, s.value - gap);
          const dash = `${length} ${100 - length}`;
          const node = (
            <path
              key={s.key}
              d={arc}
              fill="none"
              stroke={s.stroke}
              strokeWidth="34"
              strokeLinecap="butt"
              pathLength={100}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += s.value;
          return node;
        })}
        <text x="120" y="104" textAnchor="middle" className="fill-ink text-[2.6rem] font-semibold tracking-tight">
          {percent}%
        </text>
        <text x="120" y="126" textAnchor="middle" className="fill-[#5f6b64] text-[0.8rem] font-medium">
          {label}
        </text>
      </svg>
      <figcaption className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full bg-brand-600" aria-hidden /> Resolved {resolved}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full bg-brand-900" aria-hidden /> In progress {inProgress}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="bg-hatch size-3 rounded-full border border-brand-800/30" aria-hidden /> Pending {pending}
        </span>
      </figcaption>
    </figure>
  );
}
