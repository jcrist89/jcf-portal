import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import Link from "next/link";
import type { Program } from "@/lib/types";

export default async function TemplatesPage() {
  await requireUser("coach");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: templates } = await client
    .from("programs")
    .select("*")
    .eq("is_template", true)
    .order("goal");

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-16">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Program Templates</h1>
        <p className="text-jcf-gray text-sm mb-6">
          These are the starting templates auto-assigned by goal. Edit exercises, sets, reps, and rest below —
          changes only apply to newly-assigned clients; existing clients keep their own program copy.
        </p>
        <div className="flex flex-col gap-3">
          {((templates ?? []) as Program[]).map((t) => (
            <Link
              key={t.id}
              href={`/coach/templates/${t.id}`}
              className="bg-jcf-panel border border-white/10 rounded-sm p-4 hover:border-jcf-gold/50 flex items-center justify-between"
            >
              <div>
                <div className="font-display uppercase text-white">{t.name}</div>
                <div className="text-jcf-gray text-sm">{t.description}</div>
              </div>
              <span className="text-jcf-gold text-xs uppercase tracking-widest">Edit →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
