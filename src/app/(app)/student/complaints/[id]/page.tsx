import type { Metadata } from "next";
import { uuidParam } from "@/lib/http";
import { requirePageSession, loadOrDeny } from "@/lib/page-session";
import { getComplaint } from "@/modules/complaints/service";
import { ComplaintDetailView } from "@/components/complaints/complaint-detail";
import { StudentActions } from "@/components/complaints/student-actions";
import { AccessDenied } from "@/components/access-denied";

export const metadata: Metadata = { title: "Complaint" };

export default async function StudentComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requirePageSession(["STUDENT"]);
  const { id } = await params;
  const result = await loadOrDeny(() => getComplaint(actor, uuidParam(id, "Complaint")));
  if (result.denied) return <AccessDenied backHref="/student/complaints" />;

  const complaint = result.data;
  const open = complaint.status === "PENDING" || complaint.status === "IN_PROGRESS";

  return (
    <ComplaintDetailView
      complaint={complaint}
      backHref="/student/complaints"
      viewerId={actor.id}
      staff={false}
      canUpload={open}
      actions={
        complaint.status === "PENDING" || complaint.status === "RESOLVED" ? (
          <StudentActions
            complaintId={complaint.id}
            status={complaint.status}
            resolvedAt={complaint.resolvedAt}
            reopenCount={complaint.reopenCount}
            rating={complaint.satisfactionRating}
          />
        ) : null
      }
    />
  );
}
