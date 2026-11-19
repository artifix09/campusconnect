"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/field";

/** Six-digit one-time code field that phones fill from authenticator apps. */
export function CodeInput(props: ComponentProps<"input">) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      placeholder="000000"
      className="text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
      {...props}
    />
  );
}
