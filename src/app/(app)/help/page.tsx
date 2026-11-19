import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { Card, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };

const STUDENT_FAQ = [
  ["Who sees my complaint?", "Only the department it is routed to and the university's complaint office. Other students never see your complaint or your name."],
  ["What does anonymous mean?", "The department sees \"Anonymous student\" instead of your name. The complaint office can see who you are, but only after recording a reason, which is audited."],
  ["How long will it take?", "Every complaint gets a due date based on its priority: from 24 hours for urgent issues to 14 days for minor ones. Overdue complaints are escalated automatically."],
  ["It was marked resolved but it is not fixed.", "Open the complaint and choose \"Not fixed? Reopen\" within 7 days. Tell the department what is still wrong."],
  ["Someone already reported the same thing.", "While you type a title, we show similar open complaints. Tap \"Me too\" to add your support instead of filing a duplicate."],
  ["Can I report without internet?", "Yes. Install the app, write your complaint, and it is sent automatically when you are back online."],
];

const STAFF_FAQ = [
  ["Why can I only see some complaints?", "Each department admin sees only complaints routed to their department. This is enforced by the server, not just hidden in the interface."],
  ["When must I give a reason?", "Rejecting needs a reason and resolving needs a short note. Students see both."],
  ["What are internal notes?", "Messages only staff can read. Use them to coordinate without the student seeing."],
  ["A complaint is in the wrong department.", "Ask the Super Admin to reassign it. The move is recorded on the complaint's timeline."],
  ["What happens when a complaint is overdue?", "You get a reminder when the due date passes. After a further 24 hours it is escalated to the Super Admin."],
];

export default async function HelpPage() {
  const { actor } = await requirePageSession();
  const faq = actor.role === "STUDENT" ? STUDENT_FAQ : STAFF_FAQ;

  return (
    <>
      <PageHeader title="Help" description="Answers to common questions about CampusConnect." />
      <Card className="max-w-3xl">
        <div className="divide-y divide-line">
          {faq.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl py-3 font-semibold text-ink focus-ring [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-4 text-[0.9375rem] leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </Card>
    </>
  );
}
