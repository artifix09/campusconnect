"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, CircleCheck, Eye, CirclePlay, CircleX } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Select, Textarea } from "@/components/ui/field";
import type { ComplaintStatus, Priority } from "@/domain/types";

type Props = {
  complaintId: string;
  status: ComplaintStatus;
  priority: Priority;
  version: number;
  isSuperAdmin: boolean;
  isAnonymous: boolean;
  departments: { id: string; name: string }[];
  currentDepartmentId: string;
};

type Mode = null | "RESOLVED" | "REJECTED" | "reassign" | "reveal";

/** Status, priority, reassignment and identity reveal. Every action is re-checked by the server. */
export function StaffActions(props: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; email: string; registrationNo: string | null } | null>(null);

  const open = props.status === "PENDING" || props.status === "IN_PROGRESS";
  const ifMatch = { "If-Match": `"${props.version}"` };

  async function run(action: () => Promise<unknown>, close = true) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (close) {
        setMode(null);
        setNote("");
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (to: "IN_PROGRESS" | "RESOLVED" | "REJECTED", text?: string) =>
    run(() =>
      api(`/api/v1/complaints/${props.complaintId}/status`, {
        method: "PATCH",
        headers: ifMatch,
        body: to === "REJECTED" ? { to, reason: text } : { to, note: text },
      }),
    );

  if (!open && !(props.isSuperAdmin && props.isAnonymous)) {
    return (
      <p className="rounded-2xl bg-shell px-4 py-3 text-sm text-muted">
        This complaint is closed ({props.status === "RESOLVED" ? "resolved" : props.status === "REJECTED" ? "rejected" : "withdrawn by the student"}). No further actions are needed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && mode === null ? <FormMessage>{error}</FormMessage> : null}

      {props.status === "PENDING" ? (
        <Button onClick={() => changeStatus("IN_PROGRESS")} loading={busy} icon={<CirclePlay className="size-5" aria-hidden />} className="w-full">
          Start work
        </Button>
      ) : null}
      {props.status === "IN_PROGRESS" ? (
        <Button onClick={() => setMode("RESOLVED")} icon={<CircleCheck className="size-5" aria-hidden />} className="w-full">
          Mark as resolved
        </Button>
      ) : null}
      {open ? (
        <Button variant="outline" onClick={() => setMode("REJECTED")} icon={<CircleX className="size-5" aria-hidden />} className="w-full">
          Reject
        </Button>
      ) : null}

      {open ? (
        <div className="mt-2">
          <label htmlFor="priority" className="mb-1.5 block text-sm font-semibold text-ink">
            Priority
          </label>
          <Select
            id="priority"
            value={props.priority}
            disabled={busy}
            onChange={(e) =>
              run(() =>
                api(`/api/v1/complaints/${props.complaintId}/priority`, {
                  method: "PATCH",
                  headers: ifMatch,
                  body: { priority: e.target.value },
                }),
              )
            }
          >
            <option value="URGENT">Urgent (24 hours)</option>
            <option value="HIGH">High (3 days)</option>
            <option value="MEDIUM">Medium (7 days)</option>
            <option value="LOW">Low (14 days)</option>
          </Select>
          <p className="mt-1.5 text-xs text-muted">Changing priority recalculates the due date.</p>
        </div>
      ) : null}

      {props.isSuperAdmin && open ? (
        <Button variant="soft" onClick={() => setMode("reassign")} icon={<ArrowRightLeft className="size-4" aria-hidden />} className="w-full">
          Reassign department
        </Button>
      ) : null}
      {props.isSuperAdmin && props.isAnonymous && !revealed ? (
        <Button variant="ghost" onClick={() => setMode("reveal")} icon={<Eye className="size-4" aria-hidden />} className="w-full">
          Reveal student identity
        </Button>
      ) : null}
      {revealed ? (
        <div className="rounded-2xl bg-pending-soft p-4 text-sm">
          <p className="font-semibold text-ink">{revealed.name}</p>
          <p className="text-ink-soft">{revealed.email}</p>
          {revealed.registrationNo ? <p className="text-ink-soft">{revealed.registrationNo}</p> : null}
          <p className="mt-2 text-xs text-pending">This reveal was recorded in the audit log.</p>
        </div>
      ) : null}

      <Dialog
        open={mode === "RESOLVED" || mode === "REJECTED"}
        onClose={() => setMode(null)}
        title={mode === "RESOLVED" ? "Resolve complaint" : "Reject complaint"}
        description={
          mode === "RESOLVED"
            ? "Tell the student what was done. They can reopen it within 7 days if the problem is not fixed."
            : "Explain why. The student will see this reason."
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "RESOLVED" || mode === "REJECTED") void changeStatus(mode, note);
          }}
          className="flex flex-col gap-4"
        >
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Field label={mode === "RESOLVED" ? "Resolution note" : "Reason for rejection"} hint="At least 10 characters.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} autoFocus />}
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "REJECTED" ? "danger" : "primary"} loading={busy} disabled={note.trim().length < 10}>
              {mode === "RESOLVED" ? "Resolve" : "Reject"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={mode === "reassign"} onClose={() => setMode(null)} title="Reassign department" description="Use this when a complaint was filed under the wrong category.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              api(`/api/v1/complaints/${props.complaintId}/reassign`, { method: "POST", body: { departmentId, reason: note } }),
            );
          }}
          className="flex flex-col gap-4"
        >
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Field label="New department">
            {(p) => (
              <Select {...p} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                <option value="">Choose a department</option>
                {props.departments
                  .filter((d) => d.id !== props.currentDepartmentId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Reason" hint="At least 10 characters. Recorded in the audit log.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />}
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!departmentId || note.trim().length < 10}>Reassign</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={mode === "reveal"} onClose={() => setMode(null)} title="Reveal student identity" description="Only do this for a genuine reason such as abuse or safety. The reason is audited.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const res = await api<{ student: { name: string; email: string; registrationNo: string | null } }>(
                `/api/v1/admin/complaints/${props.complaintId}/reveal-identity`,
                { method: "POST", body: { reason: note } },
              );
              setRevealed(res.student);
            });
          }}
          className="flex flex-col gap-4"
        >
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Field label="Reason" hint="At least 10 characters.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />}
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={busy} disabled={note.trim().length < 10}>Reveal</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
