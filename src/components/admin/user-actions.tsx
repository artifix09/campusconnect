"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

export function CreateStaffButton({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "DEPT_ADMIN", departmentId: "" });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/admin/users", {
        method: "POST",
        body: { ...form, departmentId: form.role === "DEPT_ADMIN" ? form.departmentId : null },
      });
      setCreated(form.email);
      setForm({ name: "", email: "", role: "DEPT_ADMIN", departmentId: "" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setCreated(null); setOpen(true); }} icon={<UserPlus className="size-5" aria-hidden />}>
        Add staff account
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add staff account" description="A one-time password is emailed. They must change it and set up two-step verification at first sign-in.">
        {created ? (
          <div className="flex flex-col gap-4">
            <FormMessage tone="success">Account created. Sign-in details were sent to {created}.</FormMessage>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error ? <FormMessage>{error}</FormMessage> : null}
            <Field label="Full name">
              {(p) => <Input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Work email">
              {(p) => <Input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </Field>
            <Field label="Role">
              {(p) => (
                <Select {...p} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="DEPT_ADMIN">Department admin</option>
                  <option value="SUPER_ADMIN">Super admin</option>
                </Select>
              )}
            </Field>
            {form.role === "DEPT_ADMIN" ? (
              <Field label="Department">
                {(p) => (
                  <Select {...p} required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">Choose a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy}>Create account</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function UserStatusButton({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${userId}`, { method: "PATCH", body: { isActive } });
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <Button size="sm" variant="soft" loading={busy} onClick={() => update(true)}>
        Reactivate
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="text-rejected hover:bg-rejected-soft hover:text-rejected">
        Deactivate
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Deactivate ${name}?`} description="They are signed out everywhere immediately and cannot sign in until reactivated.">
        {error ? <div className="mb-4"><FormMessage>{error}</FormMessage></div> : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => update(false)}>Deactivate</Button>
        </div>
      </Dialog>
    </>
  );
}
