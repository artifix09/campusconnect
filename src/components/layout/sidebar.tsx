"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutEverywhere } from "@/lib/auth-client";
import { Logo } from "@/components/ui/logo";
import { InstallCard } from "@/components/pwa/install-card";
import type { Role } from "@/domain/types";
import { GENERAL, homeFor, isActive, menuFor, type NavItem } from "./nav";

export type Badges = { notifications: number; queue: number };

function NavLink({ item, pathname, badges }: { item: NavItem; pathname: string; badges: Badges }) {
  const active = isActive(pathname, item);
  const count = item.badgeKey ? badges[item.badgeKey] : 0;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-12 items-center gap-3.5 rounded-2xl px-4 text-[0.9375rem] transition-colors duration-150 focus-ring",
        active ? "font-semibold text-ink" : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      {active ? (
        <span className="absolute -left-5 top-2 bottom-2 w-1.5 rounded-r-full bg-brand-700" aria-hidden />
      ) : null}
      <Icon className={cn("size-5 shrink-0", active ? "text-brand-700" : "text-muted group-hover:text-ink")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 ? (
        <span className="rounded-md bg-brand-800 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
          {count > 99 ? "99+" : count}
          <span className="sr-only"> new</span>
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ role, badges }: { role: Role; badges: Badges }) {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Main navigation"
      className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-[17rem] shrink-0 flex-col overflow-y-auto rounded-[var(--radius-panel)] bg-shell px-5 py-7 lg:flex"
    >
      <Link href={homeFor(role)} className="mb-10 px-2 focus-ring rounded-xl">
        <Logo />
      </Link>

      <p className="mb-2 px-4 text-xs font-medium uppercase tracking-[0.08em] text-muted">Menu</p>
      <nav className="flex flex-col gap-1" aria-label="Menu">
        {menuFor(role).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} badges={badges} />
        ))}
      </nav>

      <p className="mb-2 mt-8 px-4 text-xs font-medium uppercase tracking-[0.08em] text-muted">General</p>
      <nav className="flex flex-col gap-1" aria-label="General">
        {GENERAL.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} badges={badges} />
        ))}
        <button
          type="button"
          onClick={() => void signOutEverywhere()}
          className="flex h-12 cursor-pointer items-center gap-3.5 rounded-2xl px-4 text-[0.9375rem] text-muted transition-colors hover:bg-surface hover:text-rejected focus-ring"
        >
          <LogOut className="size-5" aria-hidden />
          Log out
        </button>
      </nav>

      <div className="mt-auto pt-8">
        <InstallCard />
      </div>
    </aside>
  );
}
