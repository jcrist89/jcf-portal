import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { TodayView } from "@/components/TodayView";
import { loadToday } from "@/server/today";
import { trainingDateIn } from "@/lib/localDate";

/**
 * Today.
 *
 * The screen has one job: answer "what do I need to do right now" in about two seconds.
 * Everything on it is either an action or the reason for one — the previous dashboard's
 * lifetime workout count, longest-ever streak and recent-activity list were all facts
 * about the past that no client ever acted on.
 */
export default async function TodayPage() {
  const { client, profile } = await requireUser("client");

  const today = trainingDateIn(profile.timezone);
  const data = await loadToday(client, profile, today);

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <TodayView
          firstName={profile.full_name?.split(" ")[0] ?? "Today"}
          localDate={today}
          {...data}
        />
      </main>
    </div>
  );
}
