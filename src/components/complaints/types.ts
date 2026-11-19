import type { getComplaint, listComplaints } from "@/modules/complaints/service";
import type { listCategories } from "@/modules/org/service";

export type ComplaintListItem = Awaited<ReturnType<typeof listComplaints>>["data"][number];
export type ComplaintDetail = Awaited<ReturnType<typeof getComplaint>>;
export type CategoryOption = Awaited<ReturnType<typeof listCategories>>[number];
