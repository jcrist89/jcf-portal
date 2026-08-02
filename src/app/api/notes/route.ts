import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { notifyNewMessage } from "@/lib/push";
import { requireTier, resolveProfileId } from "@/lib/auth/authorize";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const profileId = resolveProfileId(ctx, body.profileId);
  if (!profileId) return NextResponse.json({ error: "profileId is required." }, { status: 400 });

  // Messaging is a Coaching-tier feature. The database already enforces this via
  // RLS (coach_notes_insert requires has_tier(paid_coaching) for a client-authored
  // row), so this can't actually be bypassed today — but checking here first gives
  // a clean, friendly 403 instead of a raw Postgres RLS error, and is a backstop
  // if that policy is ever loosened.
  const tierCheck = await requireTier(ctx, profileId, ["paid_coaching"]);
  if (tierCheck) return tierCheck;

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

// Unread count for the current client's own thread — powers the Messages nav badge.
export async function GET() {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;
  if (session.role !== "client") return NextResponse.json({ unreadCount: 0 });

  const { count } = await client
    .from("coach_notes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", session.id)
    .eq("author", "coach")
    .eq("read", false);

  return NextResponse.json({ unreadCount: count ?? 0 });
}

// Marks the other party's messages in a thread as read — called when a thread is opened.
export async function PATCH(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  const profileId = resolveProfileId(ctx, body?.profileId);
  if (!profileId) return NextResponse.json({ error: "profileId is required." }, { status: 400 });

  const otherAuthor = session.role === "coach" ? "client" : "coach";
  await client
    .from("coach_notes")
    .update({ read: true })
    .eq("profile_id", profileId)
    .eq("author", otherAuthor)
    .eq("read", false);

  return NextResponse.json({ ok: true });
}
