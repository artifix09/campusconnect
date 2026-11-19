"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { compressImage } from "@/lib/image-compress";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/field";
import type { ComplaintDetail } from "./types";

const MAX = 3;

/** Evidence photos. Images load through /api/v1/attachments/:id, which checks access first. */
export function Attachments({
  complaintId,
  items,
  canUpload,
}: {
  complaintId: string;
  items: ComplaintDetail["attachments"];
  canUpload: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", await compressImage(file), "photo.jpg");
      await api(`/api/v1/complaints/${complaintId}/attachments`, { method: "POST", body: form });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  if (items.length === 0 && !canUpload) return null;

  return (
    <div>
      {error ? <div className="mb-3"><FormMessage>{error}</FormMessage></div> : null}
      <div className="grid grid-cols-3 gap-3">
        {items.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setOpen(a.id)}
            className="aspect-square cursor-zoom-in overflow-hidden rounded-2xl bg-shell focus-ring"
            aria-label={`Open photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs cannot go through the image optimiser */}
            <img
              src={`/api/v1/attachments/${a.id}`}
              alt=""
              loading="lazy"
              width={a.width}
              height={a.height}
              className="size-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </button>
        ))}
        {canUpload && items.length < MAX ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 focus-ring"
          >
            <ImagePlus className="size-6" aria-hidden />
            {uploading ? "Uploading..." : "Add photo"}
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} tabIndex={-1} />

      <Dialog open={open !== null} onClose={() => setOpen(null)} title="Photo">
        {open ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/v1/attachments/${open}`} alt="Photo attached to the complaint" className="max-h-[70vh] w-full rounded-2xl object-contain" />
        ) : null}
      </Dialog>
    </div>
  );
}
