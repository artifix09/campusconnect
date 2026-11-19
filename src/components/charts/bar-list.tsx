/** Ranked horizontal bars, used for "most reported issues". */
export function BarList({
  items,
  caption,
}: {
  items: { label: string; detail?: string; value: number; secondary?: string }[];
  caption: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure>
      <ol className="flex flex-col gap-3.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">
                {item.label}
                {item.detail ? <span className="ml-1.5 font-normal text-muted">{item.detail}</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {item.value}
                {item.secondary ? <span className="ml-1 text-xs font-normal text-muted">{item.secondary}</span> : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-shell" aria-hidden>
              <div
                className={index === 0 ? "h-full rounded-full bg-brand-800" : "h-full rounded-full bg-brand-500"}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
