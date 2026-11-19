import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, EyeOff, MapPin, Star } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CategoryIcon } from "./category-icon";
import { Timeline } from "./timeline";
import { Attachments } from "./attachments";
import { Conversation } from "./conversation";
import type { ComplaintDetail } from "./types";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Complaint page shared by students and staff; `actions` carries the role-specific controls. */
export function ComplaintDetailView({
  complaint,
  backHref,
  viewerId,
  staff,
  canUpload,
  actions,
}: {
  complaint: ComplaintDetail;
  backHref: string;
  viewerId: string;
  staff: boolean;
  canUpload: boolean;
  actions: ReactNode;
}) {
  const closed = complaint.status === "WITHDRAWN";
  const outcome = complaint.resolutionNote ?? complaint.rejectionReason;

  return (
    <div className="flex flex-col gap-5">
      <Link href={backHref} className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted hover:text-ink focus-ring">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CategoryIcon code={complaint.category.code} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{complaint.referenceNo}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{complaint.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} />
            {staff ? <PriorityBadge priority={complaint.priority} /> : null}
            {complaint.overdue ? <OverdueBadge /> : null}
            {complaint.isAnonymous ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-shell px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                <EyeOff className="size-3.5" aria-hidden /> Anonymous to department
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {outcome ? (
            <section
              className={
                complaint.status === "REJECTED"
                  ? "rounded-[var(--radius-card)] border border-rejected/20 bg-rejected-soft p-5"
                  : "rounded-[var(--radius-card)] bg-brand-gradient p-5 text-white"
              }
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] opacity-80">
                {complaint.status === "REJECTED" ? "Reason for rejection" : "Department's response"}
              </h2>
              <p className="mt-2 leading-relaxed">{outcome}</p>
              {complaint.satisfactionRating ? (
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                  <Star className="size-4 fill-current" aria-hidden /> Rated {complaint.satisfactionRating} of 5
                </p>
              ) : null}
            </section>
          ) : null}

          <Card>
            <CardHeader title="Details" />
            <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">{complaint.description}</p>
            {complaint.attachments.length > 0 || canUpload ? (
              <div className="mt-5">
                <Attachments complaintId={complaint.id} items={complaint.attachments} canUpload={canUpload} />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Conversation" description={staff ? "Replies are sent to the student. Internal notes are not." : "Messages with the department."} />
            <Conversation
              complaintId={complaint.id}
              comments={complaint.comments}
              viewerId={viewerId}
              staff={staff}
              closed={closed}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          {actions ? (
            <Card>
              <CardHeader title={staff ? "Actions" : "What you can do"} as="h2" />
              {actions}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Information" />
            <dl className="divide-y divide-line">
              <Row label="Category">{complaint.category.name}</Row>
              {complaint.issueType ? <Row label="Issue">{complaint.issueType.name}</Row> : null}
              <Row label="Department">{complaint.department.name}</Row>
              {complaint.location ? (
                <Row label="Location">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {complaint.location}
                  </span>
                </Row>
              ) : null}
              <Row label="Submitted">{formatDate(complaint.createdAt, true)}</Row>
              <Row label="Due">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatDate(complaint.dueAt)}
                </span>
              </Row>
              {complaint.supportCount > 0 ? <Row label="Also reported by">{complaint.supportCount} students</Row> : null}
              {staff ? (
                <Row label="Student">
                  {complaint.student.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={complaint.student.name} size="sm" />
                      <span className="text-left">
                        <span className="block">{complaint.student.name}</span>
                        {complaint.student.registrationNo ? (
                          <span className="block text-xs font-normal text-muted">{complaint.student.registrationNo}</span>
                        ) : null}
                      </span>
                    </span>
                  ) : (
                    "Anonymous student"
                  )}
                </Row>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Timeline" description={`Last updated ${formatRelative(complaint.updatedAt)}`} />
            <Timeline events={complaint.timeline} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
