import { Suspense, type ReactNode } from "react";
import { requirePageSession } from "@/lib/page-session";
import { getProfile } from "@/modules/account/service";
import { getSummary } from "@/modules/analytics/service";
import { countUnread } from "@/modules/notifications/service";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { StatusBanners } from "@/components/pwa/status-banners";
import { LiveUpdates } from "@/components/live-updates";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession();
  const { actor } = session;

  const [profile, unread, summary] = await Promise.all([
    getProfile(session),
    countUnread(actor),
    actor.role === "STUDENT" ? null : getSummary(actor),
  ]);
  const badges = { notifications: unread, queue: summary?.pending ?? 0 };
  const user = {
    name: profile.name,
    email: profile.email,
    role: actor.role,
    department: profile.department?.name ?? null,
  };

  return (
    <>
      <div className="mx-auto flex min-h-dvh max-w-[112rem] gap-4 px-4 pb-28 sm:px-6 lg:p-4 lg:pb-4">
        <Sidebar role={actor.role} badges={badges} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense>
            <Topbar user={user} unread={unread} />
          </Suspense>
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 animate-fade-up outline-none lg:rounded-[var(--radius-panel)] lg:bg-shell lg:p-7"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav role={actor.role} badges={badges} />
      <StatusBanners />
      <LiveUpdates />
    </>
  );
}
