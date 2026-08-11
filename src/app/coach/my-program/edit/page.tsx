import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import { ProgramStructureEditor } from "@/components/ProgramStructureEditor";
import type { Program } from "@/lib/types";

/** Lets the coach tweak sets/reps/exercises on his own program in-app, reusing
 * the same editor the client-side /program/edit page uses. Permission is
 * enforced by the programs_update RLS policy — a coach can edit any program. */
export default async function EditMyProgramPage() {
  const user = await requireUser("coach");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("program_id").eq("id", user.id).single();
  if (!profile?.program_id) redirect("/coach/my-program");

  const { data: program } = await client.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
  if (!program) redirect("/coach/my-program");

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Edit My Program</h1>
        <ProgramStructureEditor
          program={program as Program}
          backHref="/coach/my-program"
          backLabel="← My Training"
          saveLabel="Save Program"
          showName={false}
        />
      </main>
    </div>
  );
}
