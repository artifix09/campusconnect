"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/field";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
];

type Option = { id: string; name: string };

/** Filters live in the URL, so a filtered view can be bookmarked or shared. */
export function ComplaintFilters({
  categories,
  departments,
  staff,
}: {
  categories: Option[];
  departments?: Option[];
  staff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const status = params.get("status") ?? "";
  const hasFilters = ["status", "categoryId", "departmentId", "priority", "overdue", "q"].some((k) => params.get(k));

  return (
    <div className={cn("mb-5 flex flex-col gap-3 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              aria-pressed={active}
              onClick={() => update("status", tab.value)}
              className={cn(
                "h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-ring",
                active ? "bg-brand-800 text-white" : "bg-surface text-ink-soft hover:bg-brand-50 hover:text-brand-800",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="filter-category">Category</label>
        <Select
          id="filter-category"
          value={params.get("categoryId") ?? ""}
          onChange={(e) => update("categoryId", e.target.value)}
          className="h-11 w-auto min-w-44 rounded-full bg-surface"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {departments ? (
          <>
            <label className="sr-only" htmlFor="filter-department">Department</label>
            <Select
              id="filter-department"
              value={params.get("departmentId") ?? ""}
              onChange={(e) => update("departmentId", e.target.value)}
              className="h-11 w-auto min-w-48 rounded-full bg-surface"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {staff ? (
          <>
            <label className="sr-only" htmlFor="filter-priority">Priority</label>
            <Select
              id="filter-priority"
              value={params.get("priority") ?? ""}
              onChange={(e) => update("priority", e.target.value)}
              className="h-11 w-auto min-w-36 rounded-full bg-surface"
            >
              <option value="">Any priority</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink-soft">
              <input
                type="checkbox"
                checked={params.get("overdue") === "true"}
                onChange={(e) => update("overdue", e.target.checked ? "true" : "")}
                className="size-4 accent-brand-700"
              />
              Overdue only
            </label>
          </>
        ) : null}

        <label className="sr-only" htmlFor="filter-sort">Sort by</label>
        <Select
          id="filter-sort"
          value={params.get("sort") ?? "-createdAt"}
          onChange={(e) => update("sort", e.target.value === "-createdAt" ? "" : e.target.value)}
          className="h-11 w-auto min-w-40 rounded-full bg-surface"
        >
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="dueAt">Due soonest</option>
          {staff ? <option value="-priority">Highest priority</option> : null}
          <option value="-supportCount">Most supported</option>
        </Select>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <X className="size-4" aria-hidden /> Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
