import { readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { exportComplaintsCsv } from "@/modules/complaints/service";
import { ExportComplaintsQuery } from "@/modules/complaints/schemas";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  const csv = await exportComplaintsCsv(actor, readQuery(req, ExportComplaintsQuery));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="complaints-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
