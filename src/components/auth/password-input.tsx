"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/field";

/** Password field with a show/hide toggle. */
export function PasswordInput(props: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 inline-flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-shell hover:text-ink"
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

/** Rough strength hint. The server enforces the real rules (length and breach checks). */
export function PasswordStrength({ value }: { value: string }) {
  const score = Math.min(4, Math.floor(value.length / 4) + (/[^A-Za-z0-9]/.test(value) ? 1 : 0));
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-rejected", "bg-rejected", "bg-pending", "bg-brand-500", "bg-brand-700"];
  if (!value) return null;
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? colors[score] : "bg-line"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted">{value.length < 10 ? "Use at least 10 characters" : labels[score]}</span>
    </div>
  );
}
