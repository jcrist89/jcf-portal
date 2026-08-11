import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { ProgressView } from "@/components/ProgressView";
import type { Measurement, PR } from "@/lib/types";

export default async function ProgressPage() {
  const { client, session: user } = await requireUser("client");

  const [{ data: measurements }, { data: prs }] = await Promise.all([
    client.from("measurements").select("*").eq("profile_id", user.id).order("date", { ascending: true }),
    client.from("prs").select("*").eq("profile_id", user.id).order("date", { ascending: true }),
  ]);

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Progress</h1>
        <ProgressView
          measurements={(measurements ?? []) as Measurement[]}
          prs={(prs ?? []) as PR[]}
          profileId={user.id}
        />
      </main>
    </div>
  );
}
