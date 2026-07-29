import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { notifyNewMessage } from "@/lib/push";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const profileId = session.role === "coach" ? body.profileId : session.id;
  if (!profileId) return NextResponse.json({ error: "profileId is required." }, { status: 400 });

  const { data: note, error } = await client
    .from("coach_notes")
    .insert({
      profile_id: profileId,
      author: session.role === "coach" ? "coach" : "client",
      message: body.message,
    })
    .select()
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message ?? "Could not send message." }, { status: 500 });
  }

  notifyNewMessage(profileId, session.role === "coach" ? "coach" : "client").catch(() => {});

  return NextResponse.json({ note });
}
