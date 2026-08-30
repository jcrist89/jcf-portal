import { requireUser } from "@/lib/auth/require";
import { CoachNav } from "@/components/CoachNav";
import { CheckinReview, type ReviewItem } from "@/components/CheckinReview";
import { compareCheckins, type Checkin } from "@/domain/checkin";

/**
 * The review queue: every check-in a client has sent that nobody has answered.
 *
 * Ordered oldest-first on purpose. Sorting newest-first quietly buries whoever has been
 * waiting longest, and that is the exact person most likely to give up.
 */
export default async function CheckinReviewPage() {
  const { client } = await requireUser("coach");

  const { data: rows } = await client
    .from("checkins")
    .select("*, profiles(full_name)")
    .not("submitted_at", "is", null)
    .is("coach_responded_at", null)
    .order("submitted_at", { ascending: true });

  const pending = (rows ?? []) as Array<Checkin & { profiles: { full_name: string | null } | null }>;

  // Every submitted check-in for the same clients, so each one can be shown beside the
  // week before it.
  const profileIds = Array.from(new Set(pending.map((c) => c.profile_id)));
  const { data: history } = profileIds.length
    ? await client
        .from("checkins")
        .select("*")
        .in("profile_id", profileIds)
        .not("submitted_at", "is", null)
        .order("due_local_date", { ascending: false })
    : { data: [] as Checkin[] };

  const now = Date.now();
  const items: ReviewItem[] = pending.map((c) => {
    const previous =
      ((history ?? []) as Checkin[]).find(
        (h) => h.profile_id === c.profile_id && h.due_local_date < c.due_local_date,
      ) ?? null;

    return {
      checkinId: c.id,
      profileId: c.profile_id,
      name: c.profiles?.full_name ?? "Unnamed client",
      dueOn: c.due_local_date,
      submittedAt: c.submitted_at,
      hoursWaiting: c.submitted_at
        ? Math.floor((now - Date.parse(c.submitted_at)) / 3_600_000)
        : null,
      fields: compareCheckins(c, previous),
      win: c.win,
      struggle: c.struggle,
      ask: c.ask,
    };
  });

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto pb-24 sm:pb-16">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Check-Ins</h1>
        <p className="text-jcf-gray text-sm mb-6">
          {items.length === 0
            ? "Nothing waiting. Everyone who checked in has heard back."
            : `${items.length} waiting on you, longest first.`}
        </p>
        {items.map((item) => (
          <CheckinReview key={item.checkinId} item={item} />
        ))}
      </main>
    </div>
  );
}
