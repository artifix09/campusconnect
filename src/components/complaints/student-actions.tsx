"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw, Star, Undo2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Textarea } from "@/components/ui/field";
import type { ComplaintStatus } from "@/domain/types";

const REOPEN_DAYS = 7;

/** Withdraw (pending), reopen (within 7 days of resolution) and rate (resolved). */
export function StudentActions({
  complaintId,
  status,
  resolvedAt,
  reopenCount,
  rating,
}: {
  complaintId: string;
  status: ComplaintStatus;
  resolvedAt: string | Date | null;
  reopenCount: number;
  rating: number | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "withdraw" | "reopen">(null);
  const [text, setText] = useState("");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canReopen =
    status === "RESOLVED" &&
    reopenCount < 1 &&
    resolvedAt !== null &&
    Date.now() - new Date(resolvedAt).getTime() < REOPEN_DAYS * 86_400_000;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode(null);
      setText("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (status !== "PENDING" && status !== "RESOLVED") return null;

  return (
    <div className="flex flex-col gap-4">
      {error && mode === null ? <FormMessage>{error}</FormMessage> : null}

      {status === "RESOLVED" && rating === null ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api(`/api/v1/complaints/${complaintId}/rating`, { method: "POST", body: { rating: stars, comment } }));
          }}
          className="rounded-[1.25rem] bg-brand-50 p-4"
        >
          <fieldset>
            <legend className="text-sm font-semibold text-ink">How well was this handled?</legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} className="peer sr-only" onChange={() => setStars(n)} />
                  <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
                  <Star
                    aria-hidden
                    className={cn(
                      "size-8 rounded-md transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500",
                      n <= stars ? "fill-[#f2b01e] text-[#f2b01e]" : "text-line-strong",
                    )}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {stars > 0 ? (
            <>
              <label htmlFor="rating-comment" className="sr-only">Comment</label>
              <Textarea
                id="rating-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything to add? (optional)"
                className="mt-3 min-h-20 bg-surface"
              />
              <Button type="submit" size="sm" loading={busy} className="mt-3">
                Submit rating
              </Button>
            </>
          ) : null}
        </form>
      ) : null}

      {canReopen ? (
        <Button variant="outline" onClick={() => setMode("reopen")} icon={<RotateCcw className="size-4" aria-hidden />} className="w-full">
          Not fixed? Reopen
        </Button>
      ) : null}

      {status === "PENDING" ? (
        <Button variant="ghost" onClick={() => setMode("withdraw")} icon={<Undo2 className="size-4" aria-hidden />} className="w-full text-rejected hover:bg-rejected-soft hover:text-rejected">
          Withdraw complaint
        </Button>
      ) : null}

      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "reopen" ? "Reopen this complaint" : "Withdraw this complaint"}
        description={
          mode === "reopen"
            ? "Tell the department what is still wrong. You can reopen a complaint once."
            : "The department will stop working on it. This cannot be undone."
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              api(`/api/v1/complaints/${complaintId}/${mode}`, { method: "POST", body: { reason: text || undefined } }),
            );
          }}
          className="flex flex-col gap-4"
        >
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Field label="Reason" optional={mode === "withdraw"} hint={mode === "reopen" ? "At least 10 characters." : undefined}>
            {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} className="min-h-24" />}
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button
              type="submit"
              variant={mode === "withdraw" ? "danger" : "primary"}
              loading={busy}
              disabled={mode === "reopen" && text.trim().length < 10}
            >
              {mode === "reopen" ? "Reopen" : "Withdraw"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
