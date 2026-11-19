import type { PillDatum } from "@/components/charts/pill-bars";

const DAY = 86_400_000;
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Turns the last seven daily counts into a Monday-to-Sunday week.
 * Days later in the week than today are marked as upcoming (drawn hatched).
 */
export function toWeek(daily: { period: Date; created: number }[], now = new Date()): PillDatum[] {
  const byDay = new Map(daily.map((d) => [new Date(d.period).toISOString().slice(0, 10), d.created]));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - mondayOffset * DAY);

  return NAMES.map((name, i) => {
    const date = new Date(monday.getTime() + i * DAY);
    const key = date.toISOString().slice(0, 10);
    return {
      label: name[0]!,
      fullLabel: name,
      value: byDay.get(key) ?? 0,
      upcoming: date > today,
      current: key === today.toISOString().slice(0, 10),
    };
  });
}
