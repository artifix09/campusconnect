import { BookOpen, GraduationCap, Monitor, Tag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  CAFETERIA: { icon: UtensilsCrossed, tone: "bg-[#fde8d7] text-[#8a3f0a]" },
  LIBRARY: { icon: BookOpen, tone: "bg-[#e3eefb] text-[#1f4f85]" },
  LAB_IT: { icon: Monitor, tone: "bg-brand-100 text-brand-800" },
  ACADEMIC: { icon: GraduationCap, tone: "bg-[#f3e5f8] text-[#6b2d80]" },
};

export function CategoryIcon({ code, size = "md", className }: { code: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const { icon: Icon, tone } = ICONS[code] ?? { icon: Tag, tone: "bg-shell text-ink-soft" };
  const dims = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-11";
  const iconDims = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-2xl", dims, tone, className)} aria-hidden>
      <Icon className={iconDims} />
    </span>
  );
}
