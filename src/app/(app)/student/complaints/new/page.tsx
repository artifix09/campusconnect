import type { Metadata } from "next";
import { requirePageSession } from "@/lib/page-session";
import { listCategories } from "@/modules/org/service";
import { PageHeader } from "@/components/ui/card";
import { NewComplaintForm } from "@/components/complaints/new-complaint-form";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewComplaintPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requirePageSession(["STUDENT"]);
  const [categories, { category }] = await Promise.all([listCategories(), searchParams]);

  return (
    <>
      <PageHeader
        title="Report an issue"
        description="Pick what it is about and we will send it to the right office automatically."
      />
      <NewComplaintForm categories={categories} initialCategory={category} />
    </>
  );
}
