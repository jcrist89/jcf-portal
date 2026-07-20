import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { ACHIEVEMENT_CATALOG } from "@/lib/achievements";
import type { Achievement } from "@/lib/types";

export default async function AchievementsPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: achievements } = await client
    .from("achievements")
    .select("*")
    .eq("profile_id", user.id)
    .order("date_earned", { ascending: false });

  const earned = (achievements ?? []) as Achievement[];
  const earnedTypes = new Set(earned.map((a) => a.type));

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Achievements</h1>
        <p className="text-jcf-gray text-sm mb-6">
          {earned.length} of {ACHIEVEMENT_CATALOG.length} badges earned
        </p>

        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENT_CATALOG.map((badge) => {
            const isEarned = earnedTypes.has(badge.type);
            const earnedEntry = earned.find((a) => a.type === badge.type);
            return (
              <div
                key={badge.type}
                className={`rounded-sm p-4 border relative overflow-hidden ${
                  isEarned
                    ? "bg-jcf-gold/10 border-jcf-gold/50"
                    : "bg-jcf-panel border-white/10 opacity-50"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 text-lg font-display ${
                    isEarned ? "bg-jcf-gold text-jcf-black" : "bg-white/10 text-jcf-gray"
                  }`}
                >
                  {badge.title.charAt(0)}
                </div>
                <div className="font-display uppercase text-sm tracking-wide text-white mb-1">
                  {badge.title}
                </div>
                <div className="text-xs text-jcf-gray">
                  {isEarned ? earnedEntry?.description : badge.description}
                </div>
                {isEarned && earnedEntry && (
                  <div className="text-[10px] text-jcf-gold mt-2 uppercase tracking-widest">
                    {earnedEntry.date_earned}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
