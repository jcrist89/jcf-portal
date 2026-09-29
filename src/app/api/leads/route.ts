import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ATTR_FIRST_COOKIE,
  ATTR_LAST_COOKIE,
  ATTR_VISITOR_COOKIE,
  decodeTouch,
} from "@/lib/attribution";
import { logEvent } from "@/lib/eventLog";

function text(value: unknown, max = 500): string | null {
  const normalized = String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
  return normalized || null;
}

function email(value: unknown): string | null {
  const v = text(value, 254)?.toLowerCase() ?? null;
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Honeypot. Bots tend to complete every field, bless their industrious little hearts.
  if (text(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const fullName = text(body.fullName, 160);
  const leadEmail = email(body.email);
  const contactHandle = text(body.contactHandle, 160);
  const goal = text(body.goal, 1000);

  if (!fullName) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!leadEmail && !contactHandle) {
    return NextResponse.json({ error: "Add an email or Instagram handle." }, { status: 400 });
  }
  if (!goal) return NextResponse.json({ error: "Tell me what you want help with." }, { status: 400 });

  const visitorRaw = req.cookies.get(ATTR_VISITOR_COOKIE)?.value ?? null;
  const visitorId =
    visitorRaw && /^[0-9a-f-]{36}$/i.test(visitorRaw) ? visitorRaw : null;
  const first = decodeTouch(req.cookies.get(ATTR_FIRST_COOKIE)?.value);
  const last = decodeTouch(req.cookies.get(ATTR_LAST_COOKIE)?.value);

  const admin = supabaseAdmin();
  const { data: lead, error } = await admin
    .from("jcf_leads")
    .insert({
      full_name: fullName,
      email: leadEmail,
      contact_handle: contactHandle,
      visitor_id: visitorId,
      source: last?.source ?? first?.source ?? "website",
      medium: last?.medium ?? first?.medium ?? "inquiry",
      campaign: last?.campaign ?? first?.campaign ?? null,
      content_id: last?.contentId ?? first?.contentId ?? null,
      inquiry_interest: text(body.inquiryInterest, 120),
      goal,
      schedule_context: text(body.scheduleContext, 1000),
      next_action: "Review inquiry and respond",
      next_action_due: new Date().toISOString().slice(0, 10),
      notes: null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    await logEvent(admin, {
      level: "error",
      source: "lead.public",
      message: "Public coaching inquiry could not be saved",
      context: { error: error?.message ?? "unknown" },
    });
    return NextResponse.json({ error: "Could not send your inquiry. Try again shortly." }, { status: 500 });
  }

  await admin.from("jcf_lead_events").insert({
    lead_id: lead.id,
    event_type: "public_inquiry",
    to_status: "new",
  });

  await logEvent(admin, {
    level: "info",
    source: "lead.public",
    message: "New coaching inquiry received",
    context: { leadId: lead.id, interest: text(body.inquiryInterest, 120) },
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
