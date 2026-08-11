import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { ProgressView } from "@/components/ProgressView";
import type { Measurement, PR } from "@/lib/types";

/** Coach's own weight/measurement/PR tracking — same ProgressView component
 * the client-facing /progress page uses, scoped to the coach's own profile. */
export default async function CoachMyProgressPage() {
  const { client, session: user } = await requireUser("coach");

  const [{ data: measurements }, { data: prs }] = await Promise.all([
    client.from("measurements").select("*").eq("profile_id", user.id).order("date", { ascending: true }),
    client.from("prs").select("*").eq("profile_id", user.id).order("date", { ascending: true }),
  ]);

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="font-display text-2xl uppercase tracking-wide">My Progress</h1>
          <Link href="/coach/my-program" className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold hover:underline shrink-0 mt-1">
            ← My Training
          </Link>
        </div>
        <ProgressView
          measurements={(measurements ?? []) as Measurement[]}
          prs={(prs ?? []) as PR[]}
          profileId={user.id}
        />
      </main>
    </div>
  );
}
