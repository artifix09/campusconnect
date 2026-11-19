import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none disabled:bg-shell disabled:text-muted aria-[invalid=true]:border-rejected aria-[invalid=true]:focus:ring-rejected-soft";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Fixed id, for focusing the control from elsewhere (e.g. after validation). */
  id?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
};

/** Label, control, hint and error wired together for screen readers. */
export function Field({ label, hint, error, optional, id: fixedId, className, children }: FieldProps) {
  const generated = useId();
  const id = fixedId ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted">(optional)</span> : null}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-rejected">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-32 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-12 cursor-pointer appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235f6b64' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const style =
    tone === "error"
      ? "bg-rejected-soft text-rejected"
      : tone === "success"
        ? "bg-resolved-soft text-resolved"
        : "bg-progress-soft text-progress";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl px-4 py-3 text-sm font-medium", style)}>
      {children}
    </div>
  );
}
