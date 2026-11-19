"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** Renders a QR code as plain SVG rectangles (no HTML injection, no image request). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = useMemo(() => encode(value, { ecc: "M", border: 2 }), [value]);
  const cells: string[] = [];
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) cells.push(`M${x} ${y}h1v1h-1z`);
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className="size-48 rounded-2xl bg-white p-2"
      shapeRendering="crispEdges"
    >
      <path d={cells.join("")} fill="#0f3624" />
    </svg>
  );
}
