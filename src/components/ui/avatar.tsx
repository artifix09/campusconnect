import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const PALETTE = [
  "bg-brand-100 text-brand-800",
  "bg-[#fde8d7] text-[#8a3f0a]",
  "bg-[#e3eefb] text-[#1f4f85]",
  "bg-[#f3e5f8] text-[#6b2d80]",
  "bg-[#fdf1dc] text-[#7d4a06]",
  "bg-[#fde6e8] text-[#8f1c2b]",
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Initials avatar with a stable colour per name. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-11 text-sm";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dims,
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
