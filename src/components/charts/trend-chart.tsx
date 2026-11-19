export type TrendDatum = { label: string; created: number; resolved: number };

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 32 };

/** Weekly complaints received (area) versus resolved (line) on one shared scale. */
export function TrendChart({ data }: { data: TrendDatum[] }) {
  const max = Math.max(4, ...data.map((d) => Math.max(d.created, d.resolved)));
  const niceMax = Math.ceil(max / 4) * 4;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  const line = (key: "created" | "resolved") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join(" ");
  const area = `${line("created")} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, niceMax / 4, niceMax / 2, (3 * niceMax) / 4, niceMax];

  return (
    <figure>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[32rem] w-full" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e3e8e4" strokeDasharray={t ? "4 6" : undefined} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-[#5f6b64] text-[11px]">
                {t}
              </text>
            </g>
          ))}
          <path d={area} fill="#d5eedf" opacity="0.7" />
          <path d={line("created")} fill="none" stroke="#1f7148" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={line("resolved")} fill="none" stroke="#0f3624" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={x(i)} cy={y(d.created)} r={i === data.length - 1 ? 5 : 3} fill="#1f7148" stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: ${d.created} received, ${d.resolved} resolved`}</title>
              </circle>
              {i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
                <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-[#5f6b64] text-[11px]">
                  {d.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-brand-600" aria-hidden /> Received
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-brand-900" aria-hidden /> Resolved
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Complaints received and resolved per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Received</th>
            <th scope="col">Resolved</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.created}</td>
              <td>{d.resolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
