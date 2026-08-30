import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { CoachQueue } from "@/components/CoachQueue";
import { loadCoachQueue } from "@/server/coachQueue";

/**
 * The coach's home: who needs attention, ranked.
 *
 * Replaces an alphabetical grid of every client with their stats. The grid answered
 * "who do I have"; this answers "who is slipping", which is the question that decides
 * whether somebody is still a client in six weeks.
 */
export default async function CoachHomePage() {
  const { client } = await requireUser("coach");
  const { queue, clientCount } = await loadCoachQueue(client);

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-24 sm:pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h1 className="font-display text-2xl uppercase tracking-wide">Who Needs Me</h1>
          <Link
            href="/coach/clients"
            className="text-jcf-gold text-xs uppercase tracking-widest hover:underline shrink-0"
          >
            All clients →
          </Link>
        </div>
        <CoachQueue initialQueue={queue} clientCount={clientCount} />
      </main>
    </div>
  );
}
