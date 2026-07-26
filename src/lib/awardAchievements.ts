import type { SupabaseClient } from "@supabase/supabase-js";
import { runAchievementChecks } from "@/lib/achievements";
import type { Profile } from "@/lib/types";

export async function checkAndAwardAchievements(
  client: SupabaseClient,
  profileId: string,
  opts: { newPr?: any; newPrs?: any[] } = {}
) {
  const [{ data: profile }, { data: existing }, { data: workoutLogs }, { data: measurements }, { data: prs }] =
    await Promise.all([
      client.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      client.from("achievements").select("*").eq("profile_id", profileId),
      client.from("workout_logs").select("*").eq("profile_id", profileId),
      client.from("measurements").select("*").eq("profile_id", profileId),
      client.from("prs").select("*").eq("profile_id", profileId),
    ]);

  if (!profile) return [];

  const newOnes = runAchievementChecks(
    {
      profile: profile as Profile,
      existing: existing ?? [],
      workoutLogs: workoutLogs ?? [],
      measurements: measurements ?? [],
      prs: prs ?? [],
    },
    opts
  );

  if (newOnes.length === 0) return [];

  const { data: inserted } = await client
    .from("achievements")
    .insert(
      newOnes.map((a) => ({
        profile_id: profileId,
        type: a.type,
        title: a.title,
        description: a.description,
        icon: a.icon,
      }))
    )
    .select();

  return inserted ?? [];
}
