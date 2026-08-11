import { requireUser } from "@/lib/auth/require";
import { notFound } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import { TemplateEditor } from "@/components/TemplateEditor";
import type { Program } from "@/lib/types";

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const { client } = await requireUser("coach");

  const { data: program } = await client.from("programs").select("*").eq("id", params.id).maybeSingle();
  if (!program) notFound();

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-24 sm:pb-16">
        <TemplateEditor program={program as Program} />
      </main>
    </div>
  );
}
