import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { CoachQueue } from "@/components/CoachQueue";
import { loadCoachQueue } from "@/server/coachQueue";

export default async function CoachHomePage() {
  const { client } = await requireUser("coach");
  const { queue, clientCount } = await loadCoachQueue(client);

  return (
    <div className="pb-24 md:pb-10">
      <CoachNav />
      <main className="mx-auto max-w-4xl px-4 pt-6">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-jcf-gray">Coach dashboard</p>
            <h1 className="font-display text-4xl uppercase leading-none tracking-wide">Who Needs Me</h1>
            <p className="mt-2 text-sm text-jcf-gray">Work the exceptions. Leave the clients who are on track alone.</p>
          </div>
          <Link
            href="/coach/clients"
            className="shrink-0 rounded-xl border border-jcf-blue/25 bg-jcf-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-jcf-blue"
          >
            All clients
          </Link>
        </div>
        <CoachQueue initialQueue={queue} clientCount={clientCount} />
      </main>
    </div>
  );
}
