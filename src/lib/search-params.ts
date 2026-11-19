import type { ZodType } from "zod";

type Raw = Record<string, string | string[] | undefined>;

/** Parses page search params with a schema; invalid values fall back to the defaults. */
export function parseSearchParams<T>(schema: ZodType<T>, raw: Raw): T {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value !== "") flat[key] = value;
  }
  const result = schema.safeParse(flat);
  if (result.success) return result.data;
  // Drop the offending keys one by one rather than failing the page.
  for (const issue of result.error.issues) delete flat[String(issue.path[0])];
  return schema.parse(flat);
}
