import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "soft" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] focus-ring disabled:pointer-events-none disabled:opacity-55 cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-[0_6px_16px_-6px_rgb(15_54_36/0.6)] hover:brightness-110",
  outline: "border border-brand-800 text-brand-900 bg-transparent hover:bg-brand-50",
  ghost: "text-ink-soft hover:bg-shell hover:text-ink",
  soft: "bg-brand-50 text-brand-800 hover:bg-brand-100",
  danger: "bg-rejected text-white hover:brightness-110",
  light: "bg-white text-brand-900 hover:bg-brand-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-7 text-base",
};

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; loading?: boolean };

export function buttonClass({ variant = "primary", size = "md" }: Pick<Common, "variant" | "size"> = {}) {
  return cn(base, variants[variant], sizes[size]);
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Button({
  variant,
  size,
  icon,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ComponentProps<"button"> & Common) {
  return (
    <button
      type={type}
      className={cn(buttonClass({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & Omit<Common, "loading">) {
  return (
    <Link className={cn(buttonClass({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** Round icon-only button. `label` is required so screen readers can name it. */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-brand-800 focus-ring",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
