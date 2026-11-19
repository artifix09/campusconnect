import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { listNotifications } from "@/modules/notifications/service";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { MarkAllRead } from "@/components/notifications/mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { actor } = await requirePageSession();
  const { data, unreadCount } = await listNotifications(actor, { limit: 50 });

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount ? `${unreadCount} unread` : "You are all caught up."}
        actions={unreadCount ? <MarkAllRead /> : null}
      />
      {data.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications yet" description="Updates about complaints will appear here." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((n) => {
            const content = (
              <>
                <span
                  className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[0.9375rem] text-ink", !n.readAt && "font-semibold")}>{n.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{formatRelative(n.createdAt)}</span>
                {!n.readAt ? <span className="sr-only">Unread.</span> : null}
              </>
            );
            const style = "flex items-start gap-3 rounded-[1.25rem] bg-surface p-4 transition-colors hover:bg-brand-50/60 focus-ring";
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={style}>
                    {content}
                  </Link>
                ) : (
                  <div className={style}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
