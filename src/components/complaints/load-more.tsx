import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Cursor pagination as a plain link, so it works without JavaScript and keeps filters. */
export function LoadMore({
  basePath,
  searchParams,
  cursor,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  cursor: string | null;
}) {
  if (!cursor) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && key !== "cursor") params.set(key, value);
  }
  params.set("cursor", cursor);
  return (
    <div className="mt-6 flex justify-center">
      <Link href={`${basePath}?${params.toString()}`} className={buttonClass({ variant: "outline" })} scroll={false}>
        <ArrowDown className="size-4" aria-hidden />
        Show more
      </Link>
    </div>
  );
}
