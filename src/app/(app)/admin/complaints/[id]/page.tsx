import type { Metadata } from "next";
import { uuidParam } from "@/lib/http";
import { requirePageSession, loadOrDeny } from "@/lib/page-session";
import { getComplaint } from "@/modules/complaints/service";
import { listDepartments } from "@/modules/org/service";
import { ComplaintDetailView } from "@/components/complaints/complaint-detail";
import { StaffActions } from "@/components/complaints/staff-actions";
import { AccessDenied } from "@/components/access-denied";

export const metadata: Metadata = { title: "Complaint" };

/**
 * A department admin opening another department's complaint by URL gets the
 * Access denied page: getComplaint() refuses on the server and audits it.
 */
export default async function AdminComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requirePageSession(["DEPT_ADMIN", "SUPER_ADMIN"]);
  const { id } = await params;
  const result = await loadOrDeny(() => getComplaint(actor, uuidParam(id, "Complaint")));
  if (result.denied) return <AccessDenied backHref="/admin/complaints" />;

  const complaint = result.data;
  const departments = actor.role === "SUPER_ADMIN" ? await listDepartments(actor) : [];

  return (
    <ComplaintDetailView
      complaint={complaint}
      backHref="/admin/complaints"
      viewerId={actor.id}
      staff
      canUpload={complaint.status === "PENDING" || complaint.status === "IN_PROGRESS"}
      actions={
        <StaffActions
          complaintId={complaint.id}
          status={complaint.status}
          priority={complaint.priority}
          version={complaint.version}
          isSuperAdmin={actor.role === "SUPER_ADMIN"}
          isAnonymous={complaint.isAnonymous}
          departments={departments.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))}
          currentDepartmentId={complaint.department.id}
        />
      }
    />
  );
}
