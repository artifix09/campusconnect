import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * CampusConnect mark: an open campus ring (the "C") with a node reaching out
 * of its gap, standing for a student's report connecting to the right office.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  // Unique per instance: a gradient referenced from a hidden copy of the logo would not render.
  const gradientId = `cc-ring-${useId().replace(/:/g, "")}`;
  const ring = inverted ? "#ffffff" : `url(#${gradientId})`;
  const node = inverted ? "#ffffff" : "#1f7148";
  return (
    <svg viewBox="0 0 40 40" className={cn("size-10", className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b8b5b" />
          <stop offset="1" stopColor="#0f3624" />
        </linearGradient>
      </defs>
      <path
        d="M30.6 11.2A13.5 13.5 0 1 0 33.5 20"
        fill="none"
        stroke={ring}
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path d="M20 20 L29.5 11.8" stroke={node} strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="20" r="4.6" fill={node} />
      <circle cx="31.2" cy="10.4" r="3.4" fill={inverted ? "#ffffff" : "#48a877"} />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span className={cn("text-xl font-bold tracking-tight", inverted ? "text-white" : "text-ink")}>
        Campus<span className={inverted ? "text-brand-200" : "text-brand-600"}>Connect</span>
      </span>
    </span>
  );
}
