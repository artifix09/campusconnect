"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CloudUpload, Trash2 } from "lucide-react";
import { listOutbox, removeFromOutbox, type QueuedComplaint } from "@/lib/offline-queue";
import { formatRelative } from "@/lib/format";

/** Complaints written offline that are waiting to be sent (or need attention). */
export function OutboxList() {
  const [items, setItems] = useState<QueuedComplaint[]>([]);

  useEffect(() => {
    const load = () => void listOutbox().then(setItems);
    load();
    window.addEventListener("outbox-change", load);
    return () => window.removeEventListener("outbox-change", load);
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-label="Waiting to send" className="mb-5 flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-4 rounded-[1.25rem] border border-dashed border-line-strong bg-surface p-4">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${item.status === "failed" ? "bg-rejected-soft text-rejected" : "bg-pending-soft text-pending"}`}
            aria-hidden
          >
            {item.status === "failed" ? <CircleAlert className="size-5" /> : <CloudUpload className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{item.payload.title}</p>
            <p className="text-xs text-muted">
              {item.status === "failed"
                ? (item.error ?? "Could not be submitted.")
                : `Waiting to send, saved ${formatRelative(new Date(item.createdAt))}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void removeFromOutbox(item.key)}
            aria-label={`Delete draft "${item.payload.title}"`}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-rejected-soft hover:text-rejected"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </section>
  );
}
