"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Send } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatRelative, ROLE_LABEL } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import type { ComplaintDetail } from "./types";

/** Messages between the student and the department, plus staff-only notes. */
export function Conversation({
  complaintId,
  comments,
  viewerId,
  staff,
  closed,
}: {
  complaintId: string;
  comments: ComplaintDetail["comments"];
  viewerId: string;
  staff: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/v1/complaints/${complaintId}/comments`, { method: "POST", body: { body, isInternal: internal } });
      setBody("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="rounded-2xl bg-shell px-4 py-6 text-center text-sm text-muted">
          No messages yet. {staff ? "Reply to the student or leave an internal note." : "The department can ask you for more details here."}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.map((c) => {
            const mine = c.author.id === viewerId;
            return (
              <li key={c.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                <Avatar name={c.author.name} size="sm" />
                <div className={cn("max-w-[85%] min-w-0", mine && "items-end text-right")}>
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink-soft">{mine ? "You" : c.author.name}</span>
                    {" · "}
                    {ROLE_LABEL[c.author.role as keyof typeof ROLE_LABEL] ?? ""}
                    {" · "}
                    {formatRelative(c.createdAt)}
                  </p>
                  <div
                    className={cn(
                      "mt-1 inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                      c.isInternal
                        ? "border border-dashed border-pending/40 bg-pending-soft text-ink"
                        : mine
                          ? "bg-brand-700 text-white"
                          : "bg-shell text-ink",
                    )}
                  >
                    {c.isInternal ? (
                      <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-pending">
                        <Lock className="size-3" aria-hidden /> Internal note, hidden from the student
                      </span>
                    ) : null}
                    {c.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {closed ? null : (
        <form onSubmit={send} className="mt-5 flex flex-col gap-3">
          {error ? <FormMessage>{error}</FormMessage> : null}
          <label htmlFor="comment-body" className="sr-only">
            Write a message
          </label>
          <Textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder={internal ? "Note for other staff (the student will not see this)" : "Write a message"}
            className="min-h-24"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {staff ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="size-4 accent-brand-700" />
                Internal note
              </label>
            ) : (
              <span />
            )}
            <Button type="submit" loading={sending} disabled={!body.trim()} icon={<Send className="size-4" aria-hidden />}>
              {internal ? "Add note" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
