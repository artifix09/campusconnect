"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Role } from "@/domain/types";
import { bottomNavFor, isActive } from "./nav";
import type { Badges } from "./sidebar";

/** Phone tab bar (hidden on large screens, where the sidebar takes over). */
export function BottomNav({ role, badges }: { role: Role; badges: Badges }) {
  const pathname = usePathname();
  const items = bottomNavFor(role);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const count = item.badgeKey ? badges[item.badgeKey] : 0;
          const isCreate = item.label === "New";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium focus-ring"
              >
                {isCreate ? (
                  <span className="-mt-6 flex size-13 items-center justify-center rounded-full bg-brand-gradient text-white shadow-[0_8px_20px_-6px_rgb(15_54_36/0.7)] ring-4 ring-surface">
                    <Icon className="size-6" aria-hidden />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className={cn("size-6", active ? "text-brand-700" : "text-muted")} aria-hidden />
                    {count > 0 ? (
                      <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-rejected px-1 text-center text-[0.625rem] leading-4 font-semibold text-white">
                        {count > 9 ? "9+" : count}
                      </span>
                    ) : null}
                  </span>
                )}
                <span className={cn(active ? "font-semibold text-brand-800" : "text-muted")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
