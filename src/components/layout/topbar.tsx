"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Search, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/ui/logo";
import { signOutEverywhere } from "@/lib/auth-client";
import { ROLE_LABEL } from "@/lib/format";
import type { Role } from "@/domain/types";
import { homeFor } from "./nav";

type User = { name: string; email: string; role: Role; department?: string | null };

export function Topbar({ user, unread }: { user: User; unread: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchPath = user.role === "STUDENT" ? "/student/complaints" : "/admin/complaints";

  // Ctrl/Cmd + K focuses search (Ctrl + F is left to the browser's own find).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 bg-canvas/85 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-4 lg:rounded-[var(--radius-panel)] lg:bg-shell lg:p-4 lg:backdrop-blur-none">
      <div className="flex items-center gap-3">
        <Link href={homeFor(user.role)} className="rounded-xl focus-ring lg:hidden" aria-label="CampusConnect home">
          <LogoMark className="size-9" />
        </Link>

        <form
          role="search"
          className="relative min-w-0 flex-1 lg:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            const q = inputRef.current?.value.trim();
            router.push(q ? `${searchPath}?q=${encodeURIComponent(q)}` : searchPath);
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Search complaints
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={inputRef}
            id="global-search"
            type="search"
            defaultValue={params.get("q") ?? ""}
            placeholder={user.role === "STUDENT" ? "Search complaints" : "Search title or CC- number"}
            className="h-12 w-full rounded-full border border-transparent bg-surface pl-12 pr-4 text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:pr-20"
          />
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-shell px-2 py-0.5 text-xs font-medium text-muted sm:block">
            Ctrl K
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800 focus-ring"
          >
            <Bell className="size-5" aria-hidden />
            {unread > 0 ? (
              <span className="absolute right-2 top-2 size-2.5 rounded-full bg-rejected ring-2 ring-surface" aria-hidden />
            ) : null}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex cursor-pointer items-center gap-3 rounded-full p-0.5 text-left focus-ring lg:pr-3"
            >
              <Avatar name={user.name} />
              <span className="hidden min-w-0 lg:block">
                <span className="block max-w-48 truncate text-[0.9375rem] font-semibold text-ink">{user.name}</span>
                <span className="block max-w-48 truncate text-sm text-muted">
                  {user.department ?? ROLE_LABEL[user.role]}
                </span>
              </span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 animate-fade-up rounded-[1.25rem] bg-surface p-2 shadow-[var(--shadow-pop)]"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-sm text-muted">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-shell hover:text-ink"
                >
                  <Settings className="size-4" aria-hidden /> Settings
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => void signOutEverywhere()}
                  className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-rejected-soft hover:text-rejected"
                >
                  <LogOut className="size-4" aria-hidden /> Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
