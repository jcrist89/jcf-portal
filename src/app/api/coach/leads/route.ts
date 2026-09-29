import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const STATUSES = new Set(["new","qualified","booked","attended","won","lost","nurture"]);

function text(value: unknown, max = 500): string | null {
  const normalized = String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
  return normalized || null;
}

function email(value: unknown): string | null {
  const v = text(value, 254)?.toLowerCase() ?? null;
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

function date(value: unknown): string | null {
  const v = text(value, 10);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const fullName = text(body.fullName, 160);
  const leadEmail = email(body.email);
  const contactHandle = text(body.contactHandle, 160);
  if (!fullName && !leadEmail && !contactHandle) {
    return NextResponse.json({ error: "Add a name, email, or contact handle." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: lead, error: insertError } = await admin
    .from("jcf_leads")
    .insert({
      full_name: fullName,
      email: leadEmail,
      contact_handle: contactHandle,
      source: text(body.source, 120) ?? "manual",
      medium: text(body.medium, 120),
      campaign: text(body.campaign, 160),
      content_id: text(body.contentId, 160),
      inquiry_interest: text(body.inquiryInterest, 120),
      goal: text(body.goal, 1000),
      schedule_context: text(body.scheduleContext, 1000),
      next_action: text(body.nextAction, 500),
      next_action_due: date(body.nextActionDue),
      notes: text(body.notes, 2000),
      created_by: ctx.session.id,
    })
    .select("*")
    .single();

  if (insertError || !lead) {
    return NextResponse.json({ error: insertError?.message ?? "Could not create lead." }, { status: 500 });
  }

  await admin.from("jcf_lead_events").insert({
    lead_id: lead.id,
    event_type: "created",
    to_status: "new",
    created_by: ctx.session.id,
  });

  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const leadId = text(body?.leadId, 64);
  if (!leadId) return NextResponse.json({ error: "leadId is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: current, error: readError } = await admin
    .from("jcf_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const requestedStatus = text(body.status, 40);
  let eventType = "updated";

  if (requestedStatus) {
    if (!STATUSES.has(requestedStatus)) {
      return NextResponse.json({ error: "Invalid lead status." }, { status: 400 });
    }
    updates.status = requestedStatus;
    eventType = "status_changed";
    const now = new Date().toISOString();

    if (requestedStatus === "qualified" && !current.qualified_at) updates.qualified_at = now;
    if (requestedStatus === "booked") {
      if (!current.qualified_at) updates.qualified_at = now;
      if (!current.booked_at) updates.booked_at = now;
    }
    if (requestedStatus === "attended") {
      if (!current.qualified_at) updates.qualified_at = now;
      if (!current.booked_at) updates.booked_at = now;
      if (!current.attended_at) updates.attended_at = now;
    }
    if (requestedStatus === "won") {
      if (!current.qualified_at) updates.qualified_at = now;
      if (!current.won_at) updates.won_at = now;
      const offerCode = text(body.offerCode, 120) ?? current.offer_code;
      if (!offerCode) {
        return NextResponse.json({ error: "Select the offer before marking a lead won." }, { status: 400 });
      }
      const { data: offer } = await admin
        .from("offers")
        .select("code,amount_cents,installments")
        .eq("code", offerCode)
        .maybeSingle();
      if (!offer) {
        return NextResponse.json({ error: "Approved offer not found." }, { status: 400 });
      }
      updates.offer_code = offer.code;
      updates.contracted_value_cents =
        Number(offer.amount_cents) * Math.max(1, Number(offer.installments ?? 1));
      updates.lost_reason = null;
      updates.lost_at = null;
    }
    if (requestedStatus === "lost") {
      const reason = text(body.lostReason, 500);
      if (!reason) {
        return NextResponse.json({ error: "Add a lost reason." }, { status: 400 });
      }
      updates.lost_reason = reason;
      updates.lost_at = now;
    }
  }

  if ("nextAction" in (body ?? {})) updates.next_action = text(body.nextAction, 500);
  if ("nextActionDue" in (body ?? {})) updates.next_action_due = date(body.nextActionDue);
  if ("notes" in (body ?? {})) updates.notes = text(body.notes, 2000);
  if ("purchaseSessionId" in (body ?? {})) updates.purchase_session_id = text(body.purchaseSessionId, 255);

  const { data: lead, error: updateError } = await admin
    .from("jcf_leads")
    .update(updates)
    .eq("id", leadId)
    .select("*")
    .single();

  if (updateError || !lead) {
    return NextResponse.json({ error: updateError?.message ?? "Could not update lead." }, { status: 500 });
  }

  await admin.from("jcf_lead_events").insert({
    lead_id: leadId,
    event_type: eventType,
    from_status: current.status,
    to_status: lead.status,
    note: text(body.eventNote, 1000),
    created_by: ctx.session.id,
  });

  return NextResponse.json({ lead });
}
