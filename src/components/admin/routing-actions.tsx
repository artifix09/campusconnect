"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, Input, Select } from "@/components/ui/field";

export function RerouteSelect({
  categoryId,
  categoryName,
  currentDepartmentId,
  departments,
}: {
  categoryId: string;
  categoryName: string;
  currentDepartmentId: string;
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = departments.find((d) => d.id === pending);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/categories/${categoryId}`, { method: "PATCH", body: { departmentId: pending } });
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label htmlFor={`route-${categoryId}`} className="sr-only">
        Department for {categoryName}
      </label>
      <Select
        id={`route-${categoryId}`}
        value={currentDepartmentId}
        onChange={(e) => setPending(e.target.value)}
        className="h-11 flex-1 rounded-full font-semibold"
      >
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Change routing?"
        description={`New ${categoryName} complaints will go to ${target?.name ?? "the selected department"}. Existing complaints stay where they are.`}
      >
        {error ? <div className="mb-4"><FormMessage>{error}</FormMessage></div> : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          <Button loading={busy} onClick={confirm}>Change routing</Button>
        </div>
      </Dialog>
    </>
  );
}

export function AddIssueType({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length < 2) return;
        setBusy(true);
        setError(null);
        try {
          await api(`/api/v1/admin/categories/${categoryId}/issue-types`, { method: "POST", body: { name: name.trim() } });
          setName("");
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={`issue-${categoryId}`} className="sr-only">New issue type</label>
      <Input id={`issue-${categoryId}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an issue type" className="h-10 rounded-full" />
      <Button type="submit" size="sm" variant="soft" loading={busy} icon={<Plus className="size-4" aria-hidden />} className="h-10">
        Add
      </Button>
      {error ? <p role="alert" className="sr-only">{error}</p> : null}
    </form>
  );
}
