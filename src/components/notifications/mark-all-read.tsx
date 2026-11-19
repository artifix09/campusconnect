"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      icon={<CheckCheck className="size-4" aria-hidden />}
      onClick={async () => {
        setBusy(true);
        await api("/api/v1/notifications/read", { method: "POST", body: { all: true } }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
    >
      Mark all as read
    </Button>
  );
}
