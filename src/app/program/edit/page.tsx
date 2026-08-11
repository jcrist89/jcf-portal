import { requireUser } from "@/lib/auth/require";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { ProgramStructureEditor } from "@/components/ProgramStructureEditor";
import type { Program } from "@/lib/types";

export default async function EditProgramPage() {
  const { client, session: user, profile } = await requireUser("client");
  if (user.tier === "free") redirect("/program");
  if (!profile.program_id) redirect("/program");

  const { data: program } = await client.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
  if (!program) redirect("/program");

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Edit My Program</h1>
        <ProgramStructureEditor
          program={program as Program}
          backHref="/program"
          backLabel="← My Program"
          saveLabel="Save Program"
          showName={false}
        />
      </main>
    </div>
  );
}
