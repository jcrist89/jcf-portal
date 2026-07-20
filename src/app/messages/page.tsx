import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { MessageThread } from "@/components/MessageThread";
import type { CoachNote } from "@/lib/types";

export default async function MessagesPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: notes } = await client
    .from("coach_notes")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <div className="pb-24 flex flex-col h-screen">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-4">Messages</h1>
        <MessageThread initialNotes={(notes ?? []) as CoachNote[]} profileId={user.id} viewerRole="client" />
      </main>
    </div>
  );
}
