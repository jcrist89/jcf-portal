import { requireUser } from "@/lib/auth/require";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { TodayView } from "@/components/TodayView";
import { loadToday } from "@/server/today";
import { trainingDateIn } from "@/lib/localDate";
import type { Profile } from "@/lib/types";

/**
 * What this client sees when they open the app.
 *
 * Renders the same component the client's own screen does, so a coach checking "does his
 * Today screen make sense" is looking at the real thing rather than an approximation
 * that quietly falls behind it.
 */
export default async function ClientPreviewPage({ params }: { params: { id: string } }) {
  const { client } = await requireUser("coach");

  const { data: profile } = await client.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!profile || profile.role !== "client") notFound();

  const p = profile as Profile;
  const today = trainingDateIn(p.timezone);
  const data = await loadToday(client, p, today);

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto pb-24 sm:pb-16">
        <Link
          href={`/coach/clients/${params.id}`}
          className="text-jcf-gold text-xs uppercase tracking-widest hover:underline"
        >
          ← Back to {p.full_name ?? "client"}
        </Link>
        <div className="mt-4">
          <TodayView
            firstName={p.full_name?.split(" ")[0] ?? "Client"}
            localDate={today}
            viewOnly
            {...data}
          />
        </div>
      </main>
    </div>
  );
}
