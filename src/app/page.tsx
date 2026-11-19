import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/session";

// The app has no public landing page: signed-in users go to their home, others to sign-in.
export default async function Home() {
  const state = await getSessionState(await headers());
  if (!state) redirect("/login");
  redirect(state.actor.role === "STUDENT" ? "/student" : "/admin");
}
